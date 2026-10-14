import { describe, expect, it } from "vitest";
import { tiers } from "@/lib/limits";
import { consume, createMemoryStore, monthKey, monthReset } from "@/lib/ratelimit";

describe("memory limit store", () => {
  it("allows `limit` hits per window, then blocks until it slides", async () => {
    let now = 1_000_000;
    const store = createMemoryStore(() => now);
    for (let i = 0; i < 3; i++) expect((await store.hit("b", "u", 3, 60_000)).success).toBe(true);
    const blocked = await store.hit("b", "u", 3, 60_000);
    expect(blocked).toMatchObject({ success: false, remaining: 0, reset: 1_060_000 });

    now += 60_001;
    expect((await store.hit("b", "u", 3, 60_000)).success).toBe(true);
  });

  it("keeps buckets and identifiers separate", async () => {
    const store = createMemoryStore();
    expect((await store.hit("a", "u", 1, 60_000)).success).toBe(true);
    expect((await store.hit("b", "u", 1, 60_000)).success).toBe(true);
    expect((await store.hit("a", "v", 1, 60_000)).success).toBe(true);
    expect((await store.hit("a", "u", 1, 60_000)).success).toBe(false);
  });

  it("counts months", async () => {
    const store = createMemoryStore();
    await store.incrementMonth("u", "2026-10");
    await store.incrementMonth("u", "2026-10");
    await store.incrementMonth("u", "2026-11");
    expect(await store.readMonth(["u", "x"], "2026-10")).toEqual([2, 0]);
  });
});

describe("consume", () => {
  const now = new Date("2026-10-14T09:00:00Z");

  it("charges the minute window and the monthly quota", async () => {
    const store = createMemoryStore(() => now.getTime());
    const d = await consume(store, "u", "standard", now);
    expect(d.ok).toBe(true);
    expect(d.minute.remaining).toBe(tiers.standard.perMinute - 1);
    expect(d.month.remaining).toBe(tiers.standard.perMonth - 1);
    expect(d.month.reset).toBe(Date.UTC(2026, 10, 1));
  });

  it("rate-limits without spending quota", async () => {
    const store = createMemoryStore(() => now.getTime());
    for (let i = 0; i < tiers.standard.perMinute; i++) await consume(store, "u", "standard", now);
    const d = await consume(store, "u", "standard", now);
    expect(d).toMatchObject({ ok: false, reason: "rate_limited" });
    expect(await store.readMonth(["u"], monthKey(now))).toEqual([tiers.standard.perMinute]);
  });

  it("stops at the monthly quota", async () => {
    const store = createMemoryStore(() => now.getTime());
    for (let i = 0; i < tiers.standard.perMonth; i++) await store.incrementMonth("u", monthKey(now));
    const d = await consume(store, "u", "standard", now);
    expect(d).toMatchObject({ ok: false, reason: "quota_exceeded" });
    expect(d.month.remaining).toBe(0);
  });

  it("uses the tier's limits", async () => {
    const store = createMemoryStore(() => now.getTime());
    const d = await consume(store, "u", "elevated", now);
    expect(d.minute.limit).toBe(tiers.elevated.perMinute);
    expect(d.month.limit).toBe(tiers.elevated.perMonth);
  });
});

describe("month helpers", () => {
  it("uses UTC calendar months", () => {
    expect(monthKey(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
    expect(monthReset(new Date("2026-12-31T23:59:59Z"))).toBe(Date.UTC(2027, 0, 1));
  });
});
