import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "./index";
import { apiKeys, users } from "./schema";

export type KeyOwner = {
  keyId: string;
  hash: string;
  userId: string;
  tier: string;
  banned: boolean;
  lastUsedAt: Date | null;
};

/** The active key with this public id, joined to its owner. */
export async function findActiveKey(id: string): Promise<KeyOwner | null> {
  const [row] = await getDb()
    .select({
      keyId: apiKeys.id,
      hash: apiKeys.hash,
      userId: users.id,
      tier: users.tier,
      bannedAt: users.bannedAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row) return null;
  const { bannedAt, ...rest } = row;
  return { ...rest, banned: bannedAt !== null };
}

export async function touchKey(id: string, at = new Date()) {
  await getDb().update(apiKeys).set({ lastUsedAt: at }).where(eq(apiKeys.id, id));
}
