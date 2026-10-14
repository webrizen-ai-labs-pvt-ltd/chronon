import { after, type NextRequest } from "next/server";
import { findActiveKey, touchKey, type KeyOwner } from "@/lib/db/queries";
import { parseKey, verifyKey } from "@/lib/keys";
import { FAILED_AUTH_PER_MINUTE, isTier, type Tier } from "@/lib/limits";
import { consume, getLimitStore, type UsageDecision } from "@/lib/ratelimit";
import { apiError } from "./respond";

export type ApiAuth = { keyId: string; userId: string; tier: Tier };

type RouteContext<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, ctx: RouteContext<P>, auth: ApiAuth) => Response | Promise<Response>;

/* Key lookups are cached per instance: revocations and bans take effect within a minute. */
const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 30_000;
const CACHE_MAX = 5_000;
const TOUCH_EVERY_MS = 5 * 60_000;

type CacheEntry = { owner: KeyOwner | null; expires: number };
// On globalThis because route handlers and server actions are bundled separately:
// a module-level Map would give the dashboard's clearKeyCache() a different copy.
const globalForKeys = globalThis as unknown as { chrononKeyCache?: Map<string, CacheEntry> };
const keyCache = (globalForKeys.chrononKeyCache ??= new Map<string, CacheEntry>());

export function clearKeyCache(id?: string) {
  if (id) keyCache.delete(id);
  else keyCache.clear();
}

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function presentedKey(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key");
}

/** Runs `task` after the response is sent (falls back to fire-and-forget outside a request). */
function defer(task: () => Promise<unknown>) {
  const safe = () => task().catch((err) => console.error("[chronon] deferred task failed", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

function limitHeaders(d: UsageDecision): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(d.minute.limit),
    "X-RateLimit-Remaining": String(d.minute.remaining),
    "X-RateLimit-Reset": String(Math.ceil(d.minute.reset / 1000)),
    "X-Quota-Limit": String(d.month.limit),
    "X-Quota-Remaining": String(d.month.remaining),
    "X-Quota-Reset": String(Math.ceil(d.month.reset / 1000)),
  };
}

/**
 * Wraps a /v1 route handler: authenticates the API key, applies the account's
 * per-minute limit and monthly quota, and adds rate-limit headers.
 */
export function withApiKey<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<Response> => {
    const raw = presentedKey(req);
    if (!raw) {
      return apiError(401, "missing_api_key", "Send your key as `Authorization: Bearer chr_…`. Get one free at /dashboard.");
    }
    const parsed = parseKey(raw);
    if (!parsed) return apiError(401, "invalid_api_key", "That doesn't look like a Chronon API key.");

    const store = getLimitStore();
    const now = Date.now();
    let entry = keyCache.get(parsed.id);

    if (!entry || entry.expires < now) {
      // Every uncached lookup costs a database query, so cap them per IP.
      const gate = await store.hit("lookup", clientIp(req), FAILED_AUTH_PER_MINUTE, 60_000);
      if (!gate.success) {
        const retry = Math.max(1, Math.ceil((gate.reset - now) / 1000));
        return apiError(429, "too_many_failed_attempts", "Too many unrecognised keys from this address. Slow down.", {
          "Retry-After": String(retry),
        });
      }
      const owner = await findActiveKey(parsed.id);
      entry = { owner, expires: now + (owner ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) };
      if (keyCache.size >= CACHE_MAX) keyCache.clear();
      keyCache.set(parsed.id, entry);
    }

    const owner = entry.owner;
    if (!owner || !verifyKey(parsed.token, owner.hash)) {
      return apiError(401, "invalid_api_key", "This API key doesn't exist or was revoked.");
    }
    if (owner.banned) {
      return apiError(403, "account_suspended", "This account is suspended for breaking the fair-use policy.");
    }

    const tier: Tier = isTier(owner.tier) ? owner.tier : "standard";
    const decision = await consume(store, owner.userId, tier);
    const headers = limitHeaders(decision);

    if (!decision.ok) {
      const resetAt = decision.reason === "rate_limited" ? decision.minute.reset : decision.month.reset;
      headers["Retry-After"] = String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
      return decision.reason === "rate_limited"
        ? apiError(429, "rate_limited", `Limit is ${decision.minute.limit} requests per minute. Retry after the reset.`, headers)
        : apiError(429, "quota_exceeded", `Monthly quota of ${decision.month.limit} requests used. It resets on the 1st (UTC).`, headers);
    }

    if (!owner.lastUsedAt || now - owner.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
      owner.lastUsedAt = new Date(now);
      defer(() => touchKey(owner.keyId, owner.lastUsedAt!));
    }

    let res: Response;
    try {
      res = await handler(req, ctx, { keyId: owner.keyId, userId: owner.userId, tier });
    } catch (err) {
      console.error("[chronon] handler failed", err);
      res = apiError(500, "internal_error", "Something went wrong on our side. Please try again.");
    }
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  };
}
