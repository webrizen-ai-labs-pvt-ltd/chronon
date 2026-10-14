import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { tiers, type Tier } from "./limits";

export type WindowResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the window frees up. */
  reset: number;
};

/** Counter storage. Upstash Redis in production, in-process memory in dev and tests. */
export interface LimitStore {
  readonly kind: "redis" | "memory";
  /** Sliding window: counts this hit and reports whether it's within `limit` per `windowMs`. */
  hit(bucket: string, id: string, limit: number, windowMs: number): Promise<WindowResult>;
  /** Increments a calendar-month counter and returns the new value. */
  incrementMonth(id: string, month: string): Promise<number>;
  /** Reads calendar-month counters (0 when missing). */
  readMonth(ids: string[], month: string): Promise<number[]>;
}

const MONTH_TTL_SECONDS = 40 * 24 * 60 * 60;

export function createRedisStore(redis: Redis): LimitStore {
  const limiters = new Map<string, Ratelimit>();
  const limiterFor = (bucket: string, limit: number, windowMs: number) => {
    const key = `${bucket}:${limit}:${windowMs}`;
    let rl = limiters.get(key);
    if (!rl) {
      rl = new Ratelimit({
        redis,
        prefix: `chronon:rl:${bucket}`,
        limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
        // Remembers blocked identifiers in this instance, so floods skip Redis entirely.
        ephemeralCache: new Map(),
      });
      limiters.set(key, rl);
    }
    return rl;
  };

  return {
    kind: "redis",
    async hit(bucket, id, limit, windowMs) {
      const r = await limiterFor(bucket, limit, windowMs).limit(id);
      return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
    },
    async incrementMonth(id, month) {
      const key = `chronon:usage:${month}:${id}`;
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, MONTH_TTL_SECONDS);
      return n;
    },
    async readMonth(ids, month) {
      if (ids.length === 0) return [];
      const values = await redis.mget<(number | string | null)[]>(...ids.map((id) => `chronon:usage:${month}:${id}`));
      return values.map((v) => Number(v ?? 0));
    },
  };
}

export function createMemoryStore(now: () => number = Date.now): LimitStore {
  const hits = new Map<string, number[]>();
  const months = new Map<string, number>();
  return {
    kind: "memory",
    async hit(bucket, id, limit, windowMs) {
      const key = `${bucket}:${id}`;
      const t = now();
      const log = (hits.get(key) ?? []).filter((ts) => ts > t - windowMs);
      const success = log.length < limit;
      if (success) log.push(t);
      hits.set(key, log);
      return {
        success,
        limit,
        remaining: Math.max(0, limit - log.length),
        reset: (log[0] ?? t) + windowMs,
      };
    },
    async incrementMonth(id, month) {
      const key = `${month}:${id}`;
      const n = (months.get(key) ?? 0) + 1;
      months.set(key, n);
      return n;
    },
    async readMonth(ids, month) {
      return ids.map((id) => months.get(`${month}:${id}`) ?? 0);
    },
  };
}

const globalForLimits = globalThis as unknown as { chrononLimitStore?: LimitStore };

export function getLimitStore(): LimitStore {
  if (!globalForLimits.chrononLimitStore) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      globalForLimits.chrononLimitStore = createRedisStore(new Redis({ url, token }));
    } else {
      if (process.env.VERCEL) {
        console.warn("[chronon] UPSTASH_REDIS_REST_URL/TOKEN not set: rate limits are per-instance only.");
      }
      globalForLimits.chrononLimitStore = createMemoryStore();
    }
  }
  return globalForLimits.chrononLimitStore;
}

/** "2026-10" in UTC. */
export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

/** Unix ms at the start of next UTC month. */
export function monthReset(date = new Date()) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export type UsageDecision =
  | { ok: true; minute: WindowResult; month: WindowResult }
  | { ok: false; reason: "rate_limited" | "quota_exceeded"; minute: WindowResult; month: WindowResult };

/**
 * Charges one request to an account: first the per-minute window, then the
 * monthly quota. Requests rejected by the minute window don't use quota.
 */
export async function consume(store: LimitStore, userId: string, tier: Tier, now = new Date()): Promise<UsageDecision> {
  const t = tiers[tier];
  const month = monthKey(now);
  const reset = monthReset(now);
  const minute = await store.hit("minute", userId, t.perMinute, 60_000);

  if (!minute.success) {
    const [used] = await store.readMonth([userId], month);
    return {
      ok: false,
      reason: "rate_limited",
      minute,
      month: { success: used < t.perMonth, limit: t.perMonth, remaining: Math.max(0, t.perMonth - used), reset },
    };
  }

  const used = await store.incrementMonth(userId, month);
  const monthResult = { success: used <= t.perMonth, limit: t.perMonth, remaining: Math.max(0, t.perMonth - used), reset };
  if (!monthResult.success) return { ok: false, reason: "quota_exceeded", minute, month: monthResult };
  return { ok: true, minute, month: monthResult };
}
