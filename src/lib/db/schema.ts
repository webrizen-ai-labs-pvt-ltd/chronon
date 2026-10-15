import { bigserial, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

/* ------------------------------------------------------------- API builder */

/** An API made in the admin builder, served at /v{n}/<slug>. */
export const apis = pgTable("apis", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  /** "dataset" | "block" */
  kind: text("kind").notNull(),
  /** "active" serves traffic; "disabled" answers 404 on every version. */
  status: text("status").notNull().default("active"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One major version of an API. Drafts are private and freely editable;
 * published versions are served and only take additive schema changes;
 * deprecated ones are still served with a Deprecation header; retired ones 410.
 */
export const apiVersions = pgTable(
  "api_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiId: uuid("api_id")
      .notNull()
      .references(() => apis.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** "draft" | "published" | "deprecated" | "retired" */
    state: text("state").notNull().default("draft"),
    definition: jsonb("definition").notNull(),
    /** Bumped on every schema or record change; serving caches key on it. */
    revision: integer("revision").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("api_versions_api_version_idx").on(t.apiId, t.version)],
);

/** A record in a dataset API version's collection. */
export const apiRecords = pgTable(
  "api_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => apiVersions.id, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
    slug: text("slug").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("api_records_version_collection_slug_idx").on(t.versionId, t.collection, t.slug)],
);

/** Who changed what in the builder. `before` holds a definition snapshot for rollback. */
export const apiAudit = pgTable(
  "api_audit",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    apiId: uuid("api_id").references(() => apis.id, { onDelete: "set null" }),
    apiSlug: text("api_slug").notNull(),
    version: integer("version"),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    before: jsonb("before"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_audit_api_id_idx").on(t.apiId), index("api_audit_created_at_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Api = typeof apis.$inferSelect;
export type ApiVersion = typeof apiVersions.$inferSelect;
export type ApiRecord = typeof apiRecords.$inferSelect;
export type ApiAuditEntry = typeof apiAudit.$inferSelect;
