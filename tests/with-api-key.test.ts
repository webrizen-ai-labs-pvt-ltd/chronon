import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeyOwner } from "@/lib/db/queries";
import { generateKey } from "@/lib/keys";
import { FAILED_AUTH_PER_MINUTE, tiers } from "@/lib/limits";
import { createMemoryStore } from "@/lib/ratelimit";

const db = vi.hoisted(() => ({ keys: new Map<string, KeyOwner>(), lookups: 0 }));

vi.mock("@/lib/db/queries", () => ({
  findActiveKey: async (id: string) => {
    db.lookups++;
    return db.keys.get(id) ?? null;
  },
  touchKey: async () => {},
}));

const { clearKeyCache, withApiKey } = await import("@/lib/api/with-api-key");

const handler = withApiKey((_req, _ctx, auth) => Response.json({ user: auth.userId, tier: auth.tier }));
const ctx = { params: Promise.resolve({}) };

function request(headers: Record<string, string> = {}, ip = "203.0.113.7") {
  return new NextRequest("http://chronon.test/v1/ping", { headers: { "x-forwarded-for": ip, ...headers } });
}

function addKey(owner: Partial<KeyOwner> = {}) {
  const key = generateKey();
  db.keys.set(key.id, { keyId: key.id, hash: key.hash, userId: "user-1", tier: "standard", banned: false, lastUsedAt: new Date(), ...owner });
  return key.token;
}

beforeEach(() => {
  db.keys.clear();
  db.lookups = 0;
  clearKeyCache();
  (globalThis as { chrononLimitStore?: unknown }).chrononLimitStore = createMemoryStore();
});

describe("withApiKey", () => {
  it("rejects requests without a key", async () => {
    const res = await handler(request(), ctx);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("missing_api_key");
  });

  it("rejects malformed keys without touching the database", async () => {
    const res = await handler(request({ authorization: "Bearer nope" }), ctx);
    expect(res.status).toBe(401);
    expect(db.lookups).toBe(0);
  });

  it("rejects unknown keys and keys with the wrong secret", async () => {
    expect((await handler(request({ authorization: `Bearer ${generateKey().token}` }), ctx)).status).toBe(401);
    const token = addKey();
    const forged = token.slice(0, 13) + "A".repeat(32);
    expect((await handler(request({ authorization: `Bearer ${forged}` }), ctx)).status).toBe(401);
  });

  it("accepts valid keys via Authorization or X-API-Key, with limit headers", async () => {
    const token = addKey();
    const variants: Record<string, string>[] = [{ authorization: `Bearer ${token}` }, { "x-api-key": token }];
    for (const headers of variants) {
      const res = await handler(request(headers), ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ user: "user-1", tier: "standard" });
      expect(res.headers.get("x-ratelimit-limit")).toBe(String(tiers.standard.perMinute));
      expect(res.headers.get("x-quota-limit")).toBe(String(tiers.standard.perMonth));
    }
  });

  it("caches lookups", async () => {
    const token = addKey();
    for (let i = 0; i < 5; i++) await handler(request({ "x-api-key": token }), ctx);
    expect(db.lookups).toBe(1);
  });

  it("blocks suspended accounts", async () => {
    const token = addKey({ banned: true });
    const res = await handler(request({ "x-api-key": token }), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("account_suspended");
  });

  it("applies the per-minute limit per account, across keys", async () => {
    const a = addKey();
    const b = addKey();
    for (let i = 0; i < tiers.standard.perMinute; i++) {
      expect((await handler(request({ "x-api-key": i % 2 ? a : b }), ctx)).status).toBe(200);
    }
    const res = await handler(request({ "x-api-key": a }), ctx);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("rate_limited");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("caps uncached lookups per IP", async () => {
    for (let i = 0; i < FAILED_AUTH_PER_MINUTE; i++) {
      await handler(request({ "x-api-key": generateKey().token }), ctx);
    }
    const res = await handler(request({ "x-api-key": generateKey().token }), ctx);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("too_many_failed_attempts");
    expect(db.lookups).toBe(FAILED_AUTH_PER_MINUTE);
    // Another address is unaffected.
    expect((await handler(request({ "x-api-key": generateKey().token }, "198.51.100.1"), ctx)).status).toBe(401);
  });

  it("sees revocations after the cache is cleared", async () => {
    const token = addKey();
    expect((await handler(request({ "x-api-key": token }), ctx)).status).toBe(200);
    db.keys.clear();
    clearKeyCache();
    expect((await handler(request({ "x-api-key": token }), ctx)).status).toBe(401);
  });

  it("turns handler crashes into a JSON 500", async () => {
    const token = addKey();
    const crashing = withApiKey(() => {
      throw new Error("boom");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await crashing(request({ "x-api-key": token }), ctx);
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal_error");
  });
});
