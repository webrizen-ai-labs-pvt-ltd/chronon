import "server-only";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";
import { generateKey } from "@/lib/keys";
import { KEY_CREATIONS_PER_HOUR, MAX_ACTIVE_KEYS, type Tier } from "@/lib/limits";
import { getLimitStore, monthKey } from "@/lib/ratelimit";

export async function listKeys(userId: string) {
  return getDb()
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
}

export async function monthlyUsage(userIds: string[]) {
  const values = await getLimitStore().readMonth(userIds, monthKey());
  return new Map(userIds.map((id, i) => [id, values[i] ?? 0]));
}

export type CreateKeyResult = { ok: true; id: string; token: string } | { ok: false; error: string };

export async function createKey(userId: string, rawName: string): Promise<CreateKeyResult> {
  const name = rawName.trim().slice(0, 48) || "Untitled key";

  const gate = await getLimitStore().hit("key-create", userId, KEY_CREATIONS_PER_HOUR, 60 * 60_000);
  if (!gate.success) return { ok: false, error: "You've created a lot of keys recently. Try again in an hour." };

  const db = getDb();
  const [{ active }] = await db
    .select({ active: count() })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  if (active >= MAX_ACTIVE_KEYS) {
    return { ok: false, error: `You can have ${MAX_ACTIVE_KEYS} active keys. Revoke one first.` };
  }

  const key = generateKey();
  await db.insert(apiKeys).values({ id: key.id, userId, name, hash: key.hash });
  return { ok: true, id: key.id, token: key.token };
}

/** Revokes one of the user's keys. Returns false if it wasn't theirs or was already revoked. */
export async function revokeKey(userId: string, keyId: string) {
  const rows = await getDb()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return rows.length > 0;
}

/* --------------------------------- Admin ---------------------------------- */

export async function searchUsers(term: string, limit = 50) {
  const db = getDb();
  // Qualified by hand: Drizzle renders columns unqualified here, which would make "id" resolve to api_keys.id.
  const activeKeys = sql<number>`(select count(*)::int from "api_keys" k where k."user_id" = "users"."id" and k."revoked_at" is null)`;
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      tier: users.tier,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      activeKeys,
    })
    .from(users)
    .where(term ? or(ilike(users.email, pattern), ilike(users.name, pattern)) : undefined)
    .orderBy(desc(users.lastSeenAt))
    .limit(limit);
}

export async function setTier(userId: string, tier: Tier) {
  await getDb().update(users).set({ tier }).where(eq(users.id, userId));
}

export async function setBanned(userId: string, banned: boolean, reason?: string) {
  await getDb()
    .update(users)
    .set(banned ? { bannedAt: new Date(), banReason: reason?.slice(0, 200) || null } : { bannedAt: null, banReason: null })
    .where(eq(users.id, userId));
}
