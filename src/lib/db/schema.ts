import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** A developer, keyed by their Webrizen SSO subject. Created on first dashboard visit. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  ssoSub: text("sso_sub").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  image: text("image"),
  tier: text("tier").notNull().default("standard"),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * API keys. `id` is the public part of the key (chr_<id>_<secret>); only a
 * SHA-256 hash of the full key is stored.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hash: text("hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("api_keys_user_id_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
