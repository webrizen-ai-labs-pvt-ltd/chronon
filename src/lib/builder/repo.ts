import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { apiAudit, apiRecords, apis, apiVersions, type Api, type ApiVersion } from "@/lib/db/schema";
import { blockById, blockSettingsSchema, defaultSettings } from "./blocks";
import { breakingChanges } from "./compat";
import {
  checkDataset,
  definitionSchema,
  LIMITS,
  SLUG_RE,
  type BlockDefinition,
  type Collection,
  type DatasetDefinition,
  type Definition,
} from "./definition";
import { validateRecord, type RecordErrors, type RecordInput } from "./records";
import { menusDefinition, menusRecords } from "./seeds/menus";

/**
 * Database operations behind the admin builder. Every mutation validates
 * against the definition, writes an audit entry and bumps the version's
 * revision so serving caches refresh.
 */

export type VersionState = "draft" | "published" | "deprecated" | "retired";
export type Result<T = undefined> = ({ ok: true } & ([T] extends [undefined] ? object : { value: T })) | { ok: false; error: string };

/** Paths the platform owns; APIs can't take these slugs. */
export const RESERVED_SLUGS = new Set(["ping", "status", "health", "openapi", "docs", "auth", "admin", "dashboard", "keys", "random"]);

const fail = (error: string) => ({ ok: false as const, error });

async function audit(
  entry: { apiId: string | null; apiSlug: string; version?: number | null; actor: string; action: string; summary: string; before?: unknown },
) {
  await getDb()
    .insert(apiAudit)
    .values({ ...entry, version: entry.version ?? null, before: entry.before ?? null });
}

async function bumpRevision(versionId: string) {
  await getDb()
    .update(apiVersions)
    .set({ revision: sql`${apiVersions.revision} + 1`, updatedAt: new Date() })
    .where(eq(apiVersions.id, versionId));
}

/* ------------------------------------------------------------------ reads */

export type ApiSummary = Api & {
  versions: { id: string; version: number; state: string; revision: number; publishedAt: Date | null; updatedAt: Date }[];
  records: number;
};

export async function listApis(): Promise<ApiSummary[]> {
  const db = getDb();
  const [rows, versions, counts] = await Promise.all([
    db.select().from(apis).orderBy(asc(apis.name)),
    db
      .select({
        id: apiVersions.id,
        apiId: apiVersions.apiId,
        version: apiVersions.version,
        state: apiVersions.state,
        revision: apiVersions.revision,
        publishedAt: apiVersions.publishedAt,
        updatedAt: apiVersions.updatedAt,
      })
      .from(apiVersions)
      .orderBy(asc(apiVersions.version)),
    db
      .select({ apiId: apiVersions.apiId, n: count() })
      .from(apiRecords)
      .innerJoin(apiVersions, eq(apiRecords.versionId, apiVersions.id))
      .groupBy(apiVersions.apiId),
  ]);
  const recordsBy = new Map(counts.map((c) => [c.apiId, c.n]));
  return rows.map((a) => ({ ...a, versions: versions.filter((v) => v.apiId === a.id), records: recordsBy.get(a.id) ?? 0 }));
}

export async function getApi(slug: string) {
  const db = getDb();
  const [api] = await db.select().from(apis).where(eq(apis.slug, slug)).limit(1);
  if (!api) return null;
  const versions = await db.select().from(apiVersions).where(eq(apiVersions.apiId, api.id)).orderBy(asc(apiVersions.version));
  return { api, versions };
}

export async function getVersion(apiSlug: string, version: number) {
  const found = await getApi(apiSlug);
  const v = found?.versions.find((x) => x.version === version);
  return found && v ? { api: found.api, version: v, versions: found.versions } : null;
}

export function parseDefinition(v: ApiVersion): Definition {
  return definitionSchema.parse(v.definition);
}

export async function recordCounts(versionId: string) {
  const rows = await getDb()
    .select({ collection: apiRecords.collection, n: count() })
    .from(apiRecords)
    .where(eq(apiRecords.versionId, versionId))
    .groupBy(apiRecords.collection);
  return new Map(rows.map((r) => [r.collection, r.n]));
}

export async function listRecords(versionId: string, collection: string, opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 10), 200);
  const page = Math.max(opts.page ?? 1, 1);
  const where = and(
    eq(apiRecords.versionId, versionId),
    eq(apiRecords.collection, collection),
    opts.q ? ilike(sql`${apiRecords.slug} || ' ' || ${apiRecords.data}::text`, `%${opts.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
  );
  const db = getDb();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ slug: apiRecords.slug, data: apiRecords.data, updatedAt: apiRecords.updatedAt })
      .from(apiRecords)
      .where(where)
      .orderBy(asc(apiRecords.slug))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(apiRecords).where(where),
  ]);
  return { rows: rows.map((r) => ({ ...r, data: r.data as Record<string, unknown> })), total, page, pageSize };
}

/** All records of a version, grouped by collection (serving, export, publish checks). */
export async function allRecords(versionId: string) {
  const rows = await getDb()
    .select({ collection: apiRecords.collection, slug: apiRecords.slug, data: apiRecords.data })
    .from(apiRecords)
    .where(eq(apiRecords.versionId, versionId))
    .orderBy(asc(apiRecords.slug));
  const out: Record<string, { slug: string; data: Record<string, unknown> }[]> = {};
  for (const r of rows) (out[r.collection] ??= []).push({ slug: r.slug, data: r.data as Record<string, unknown> });
  return out;
}

export async function listAudit(opts: { apiId?: string; limit?: number } = {}) {
  return getDb()
    .select()
    .from(apiAudit)
    .where(opts.apiId ? eq(apiAudit.apiId, opts.apiId) : undefined)
    .orderBy(desc(apiAudit.createdAt))
    .limit(Math.min(opts.limit ?? 50, 200));
}

/* -------------------------------------------------------------- APIs */

function starterDefinition(kind: "dataset" | "block", block?: string): Result<Definition> {
  if (kind === "block") {
    const b = block ? blockById.get(block) : undefined;
    if (!b) return fail("Pick a block.");
    return { ok: true, value: { kind: "block", block: b.id, config: defaultSettings(b) } };
  }
  return {
    ok: true,
    value: definitionSchema.parse({
      kind: "dataset",
      collections: [{ slug: "items", name: "Items", fields: [{ key: "name", label: "Name", type: "text", required: true, maxLength: 120 }], sort: [{ field: "name" }] }],
    }),
  };
}

export async function createApi(input: {
  slug: string;
  name: string;
  summary: string;
  kind: "dataset" | "block";
  block?: string;
  /** A complete dataset definition (e.g. from a spreadsheet); defaults to a starter schema. */
  definition?: unknown;
  actor: string;
}): Promise<Result<string>> {
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug) || slug.length > 40) return fail("Use lowercase-kebab-case for the slug, up to 40 characters.");
  if (RESERVED_SLUGS.has(slug)) return fail(`"${slug}" is reserved by the platform.`);
  const name = input.name.trim().slice(0, 60);
  if (!name) return fail("Give the API a name.");
  const def = input.definition !== undefined ? validateDefinition(input.definition) : starterDefinition(input.kind, input.block);
  if (!def.ok) return def;
  if (def.value.kind !== input.kind) return fail("The definition doesn't match the API type.");

  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(apis);
  if (n >= LIMITS.apis) return fail(`The platform holds up to ${LIMITS.apis} APIs. Delete one first.`);
  const [existing] = await db.select({ id: apis.id }).from(apis).where(eq(apis.slug, slug)).limit(1);
  if (existing) return fail(`An API called "${slug}" already exists.`);

  const [api] = await db
    .insert(apis)
    .values({ slug, name, summary: input.summary.trim().slice(0, 200), kind: input.kind, createdBy: input.actor })
    .returning();
  await db.insert(apiVersions).values({ apiId: api.id, version: 1, state: "draft", definition: def.value });
  await audit({ apiId: api.id, apiSlug: slug, version: 1, actor: input.actor, action: "api.create", summary: input.definition !== undefined ? `Created "${name}" from a spreadsheet.` : `Created ${input.kind} API "${name}".` });
  return { ok: true, value: slug };
}

export async function updateApiMeta(apiId: string, input: { name: string; summary: string; actor: string }): Promise<Result> {
  const name = input.name.trim().slice(0, 60);
  if (!name) return fail("Give the API a name.");
  const [api] = await getDb()
    .update(apis)
    .set({ name, summary: input.summary.trim().slice(0, 200), updatedAt: new Date() })
    .where(eq(apis.id, apiId))
    .returning();
  if (!api) return fail("API not found.");
  await audit({ apiId, apiSlug: api.slug, actor: input.actor, action: "api.update", summary: "Updated name and summary." });
  return { ok: true };
}

export async function setApiStatus(apiId: string, status: "active" | "disabled", actor: string): Promise<Result> {
  const [api] = await getDb().update(apis).set({ status, updatedAt: new Date() }).where(eq(apis.id, apiId)).returning();
  if (!api) return fail("API not found.");
  await audit({ apiId, apiSlug: api.slug, actor, action: status === "active" ? "api.enable" : "api.disable", summary: status === "active" ? "Enabled the API." : "Disabled the API: every version answers 404." });
  return { ok: true };
}

export async function deleteApi(apiId: string, confirmSlug: string, actor: string): Promise<Result> {
  const db = getDb();
  const [api] = await db.select().from(apis).where(eq(apis.id, apiId)).limit(1);
  if (!api) return fail("API not found.");
  if (confirmSlug.trim() !== api.slug) return fail(`Type "${api.slug}" to confirm.`);
  await db.delete(apis).where(eq(apis.id, apiId));
  await audit({ apiId: null, apiSlug: api.slug, actor, action: "api.delete", summary: `Deleted "${api.name}" and all its versions and records.` });
  return { ok: true };
}

/* ----------------------------------------------------------- definitions */

async function versionRow(versionId: string) {
  const db = getDb();
  const [row] = await db
    .select({ v: apiVersions, api: apis })
    .from(apiVersions)
    .innerJoin(apis, eq(apis.id, apiVersions.apiId))
    .where(eq(apiVersions.id, versionId))
    .limit(1);
  return row ?? null;
}

/** Validates a definition, including the rules for its kind. */
export function validateDefinition(raw: unknown): Result<Definition> {
  const parsed = definitionSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`${issue.path.join(".") || "definition"}: ${issue.message}`);
  }
  const def = parsed.data;
  if (def.kind === "dataset") {
    const problems = checkDataset(def);
    if (problems.length) return fail(problems.join(" "));
  } else {
    const b = blockById.get(def.block);
    if (!b) return fail(`Unknown block "${def.block}".`);
    const settings = blockSettingsSchema(b).safeParse(def.config);
    if (!settings.success) return fail(`Settings: ${settings.error.issues[0]?.path.join(".")} ${settings.error.issues[0]?.message}`);
    def.config = settings.data;
  }
  return { ok: true, value: def };
}

export async function saveDefinition(versionId: string, raw: unknown, actor: string): Promise<Result> {
  const row = await versionRow(versionId);
  if (!row) return fail("Version not found.");
  if (row.v.state === "retired") return fail("Retired versions are read-only.");
  const checked = validateDefinition(raw);
  if (!checked.ok) return checked;
  const before = definitionSchema.parse(row.v.definition);
  const def = checked.value;
  if (before.kind !== def.kind) return fail("An API can't change kind.");

  if (row.v.state !== "draft" && before.kind === "dataset" && def.kind === "dataset") {
    const breaking = breakingChanges(before, def);
    if (breaking.length) return fail(`v${row.v.version} is live, so it only takes additive changes. Start v${row.v.version + 1} for: ${breaking.join(" ")}`);
  }
  if (def.kind === "dataset") {
    // Records of removed collections go with them.
    const keep = def.collections.map((c) => c.slug);
    await getDb()
      .delete(apiRecords)
      .where(and(eq(apiRecords.versionId, versionId), notInArray(apiRecords.collection, keep)));
  }
  await getDb().update(apiVersions).set({ definition: def, updatedAt: new Date() }).where(eq(apiVersions.id, versionId));
  await bumpRevision(versionId);
  await audit({ apiId: row.api.id, apiSlug: row.api.slug, version: row.v.version, actor, action: "schema.update", summary: describeChange(before, def), before });
  return { ok: true };
}

function describeChange(before: Definition, after: Definition) {
  if (before.kind === "block" || after.kind === "block") return "Updated block settings.";
  const parts: string[] = [];
  const b = new Map(before.collections.map((c) => [c.slug, c]));
  for (const c of after.collections) {
    const o = b.get(c.slug);
    if (!o) parts.push(`added collection ${c.slug}`);
    else {
      const added = c.fields.filter((f) => !o.fields.some((x) => x.key === f.key)).map((f) => f.key);
      const removed = o.fields.filter((f) => !c.fields.some((x) => x.key === f.key)).map((f) => f.key);
      if (added.length) parts.push(`${c.slug}: added ${added.join(", ")}`);
      if (removed.length) parts.push(`${c.slug}: removed ${removed.join(", ")}`);
    }
  }
  for (const o of before.collections) if (!after.collections.some((c) => c.slug === o.slug)) parts.push(`removed collection ${o.slug}`);
  return parts.length ? `Schema: ${parts.join("; ")}.` : "Updated endpoint settings.";
}

/* --------------------------------------------------------------- records */

async function datasetVersion(versionId: string, collection: string) {
  const row = await versionRow(versionId);
  if (!row) return { error: "Version not found." } as const;
  if (row.v.state === "retired") return { error: "Retired versions are read-only." } as const;
  const def = definitionSchema.parse(row.v.definition);
  if (def.kind !== "dataset") return { error: "This API has no records." } as const;
  const c = def.collections.find((x) => x.slug === collection);
  if (!c) return { error: `Unknown collection "${collection}".` } as const;
  return { row, def, c } as const;
}

/** Slugs per referenced collection, for reference checks. */
async function referenceIndex(versionId: string, def: DatasetDefinition, c: Collection) {
  const targets = [...new Set(c.fields.filter((f) => f.type === "reference" && f.target).map((f) => f.target!))];
  if (!targets.length) return () => true;
  const rows = await getDb()
    .select({ collection: apiRecords.collection, slug: apiRecords.slug })
    .from(apiRecords)
    .where(and(eq(apiRecords.versionId, versionId), inArray(apiRecords.collection, targets)));
  const set = new Set(rows.map((r) => `${r.collection}/${r.slug}`));
  return (collection: string, slug: string) => set.has(`${collection}/${slug}`);
}

async function totalRecords(versionId: string) {
  const [{ n }] = await getDb().select({ n: count() }).from(apiRecords).where(eq(apiRecords.versionId, versionId));
  return n;
}

export type SaveRecordResult = { ok: true } | { ok: false; error: string; fields?: RecordErrors };

export async function saveRecord(versionId: string, collection: string, originalSlug: string | null, input: RecordInput, actor: string): Promise<SaveRecordResult> {
  const ctx = await datasetVersion(versionId, collection);
  if ("error" in ctx) return fail(ctx.error!);
  const refExists = await referenceIndex(versionId, ctx.def, ctx.c);
  const v = validateRecord(ctx.c, input, refExists);
  if (!v.ok) return { ok: false, error: "Fix the highlighted fields.", fields: v.errors };
  const db = getDb();
  const { slug, data } = v.record;

  if (originalSlug === null) {
    if ((await totalRecords(versionId)) >= LIMITS.recordsPerApi) return fail(`Each API version holds up to ${LIMITS.recordsPerApi.toLocaleString("en")} records.`);
    const [clash] = await db
      .select({ id: apiRecords.id })
      .from(apiRecords)
      .where(and(eq(apiRecords.versionId, versionId), eq(apiRecords.collection, collection), eq(apiRecords.slug, slug)))
      .limit(1);
    if (clash) return { ok: false, error: "Fix the highlighted fields.", fields: { slug: "Another record already uses this slug." } };
    await db.insert(apiRecords).values({ versionId, collection, slug, data });
  } else {
    if (slug !== originalSlug) {
      const [clash] = await db
        .select({ id: apiRecords.id })
        .from(apiRecords)
        .where(and(eq(apiRecords.versionId, versionId), eq(apiRecords.collection, collection), eq(apiRecords.slug, slug)))
        .limit(1);
      if (clash) return { ok: false, error: "Fix the highlighted fields.", fields: { slug: "Another record already uses this slug." } };
      const blocking = await referencesTo(versionId, ctx.def, collection, [originalSlug]);
      if (blocking) return { ok: false, error: `Can't rename: ${blocking}`, fields: { slug: "Referenced by other records." } };
    }
    const updated = await db
      .update(apiRecords)
      .set({ slug, data, updatedAt: new Date() })
      .where(and(eq(apiRecords.versionId, versionId), eq(apiRecords.collection, collection), eq(apiRecords.slug, originalSlug)))
      .returning({ id: apiRecords.id });
    if (!updated.length) return fail("That record no longer exists.");
  }
  await bumpRevision(versionId);
  await audit({
    apiId: ctx.row.api.id,
    apiSlug: ctx.row.api.slug,
    version: ctx.row.v.version,
    actor,
    action: originalSlug === null ? "record.create" : "record.update",
    summary: `${originalSlug === null ? "Added" : "Edited"} ${collection}/${slug}.`,
  });
  return { ok: true };
}

/** Describes records in other collections that point at `slugs`, or null if none do. */
async function referencesTo(versionId: string, def: DatasetDefinition, collection: string, slugs: string[]) {
  for (const other of def.collections) {
    for (const f of other.fields) {
      if (f.type !== "reference" || f.target !== collection) continue;
      const [{ n }] = await getDb()
        .select({ n: count() })
        .from(apiRecords)
        .where(and(eq(apiRecords.versionId, versionId), eq(apiRecords.collection, other.slug), inArray(sql`${apiRecords.data}->>${f.key}`, slugs)));
      if (n > 0) return `${n} ${other.slug} record${n === 1 ? "" : "s"} still reference ${slugs.length === 1 ? "it" : "them"} through "${f.key}".`;
    }
  }
  return null;
}

export async function deleteRecords(versionId: string, collection: string, slugs: string[], actor: string): Promise<Result> {
  if (!slugs.length) return { ok: true };
  const ctx = await datasetVersion(versionId, collection);
  if ("error" in ctx) return fail(ctx.error!);
  const blocking = await referencesTo(versionId, ctx.def, collection, slugs);
  if (blocking) return fail(`Can't delete: ${blocking}`);
  await getDb()
    .delete(apiRecords)
    .where(and(eq(apiRecords.versionId, versionId), eq(apiRecords.collection, collection), inArray(apiRecords.slug, slugs)));
  await bumpRevision(versionId);
  await audit({
    apiId: ctx.row.api.id,
    apiSlug: ctx.row.api.slug,
    version: ctx.row.v.version,
    actor,
    action: "record.delete",
    summary: slugs.length === 1 ? `Deleted ${collection}/${slugs[0]}.` : `Deleted ${slugs.length} ${collection} records.`,
  });
  return { ok: true };
}

export type ImportReport = { ok: true; inserted: number; updated: number } | { ok: false; error: string; rows?: { row: number; slug: string; errors: RecordErrors }[] };

/**
 * Imports parsed rows (from CSV or JSON). All-or-nothing: if any row is
 * invalid nothing is written and every problem is reported.
 */
export async function importRecords(
  versionId: string,
  collection: string,
  inputs: RecordInput[],
  mode: "upsert" | "replace",
  actor: string,
): Promise<ImportReport> {
  const ctx = await datasetVersion(versionId, collection);
  if ("error" in ctx) return fail(ctx.error!);
  if (!inputs.length) return fail("The file has no rows.");
  const refExists = await referenceIndex(versionId, ctx.def, ctx.c);
  const problems: { row: number; slug: string; errors: RecordErrors }[] = [];
  const valid: { slug: string; data: Record<string, unknown> }[] = [];
  const seen = new Set<string>();
  inputs.forEach((input, i) => {
    const v = validateRecord(ctx.c, input, refExists);
    const slug = typeof input.slug === "string" ? input.slug : "";
    if (!v.ok) problems.push({ row: i + 2, slug, errors: v.errors });
    else if (seen.has(v.record.slug)) problems.push({ row: i + 2, slug, errors: { slug: "Appears twice in the file." } });
    else {
      seen.add(v.record.slug);
      valid.push(v.record);
    }
  });
  if (problems.length) return { ok: false, error: `${problems.length} row${problems.length === 1 ? " has" : "s have"} problems. Nothing was imported.`, rows: problems.slice(0, 200) };

  const db = getDb();
  const existing = await db
    .select({ slug: apiRecords.slug })
    .from(apiRecords)
    .where(and(eq(apiRecords.versionId, versionId), eq(apiRecords.collection, collection)));
  const existingSet = new Set(existing.map((r) => r.slug));
  const total = await totalRecords(versionId);
  const after = mode === "replace" ? total - existing.length + valid.length : total + valid.filter((r) => !existingSet.has(r.slug)).length;
  if (after > LIMITS.recordsPerApi) return fail(`This would leave ${after.toLocaleString("en")} records; each version holds up to ${LIMITS.recordsPerApi.toLocaleString("en")}.`);

  if (mode === "replace") {
    const dropped = existing.map((r) => r.slug).filter((s) => !seen.has(s));
    if (dropped.length) {
      const blocking = await referencesTo(versionId, ctx.def, collection, dropped);
      if (blocking) return fail(`Replacing would remove records that are in use: ${blocking}`);
    }
  }

  await db.transaction(async (tx) => {
    if (mode === "replace") await tx.delete(apiRecords).where(and(eq(apiRecords.versionId, versionId), eq(apiRecords.collection, collection)));
    for (let i = 0; i < valid.length; i += 500) {
      const chunk = valid.slice(i, i + 500).map((r) => ({ versionId, collection, slug: r.slug, data: r.data }));
      await tx
        .insert(apiRecords)
        .values(chunk)
        .onConflictDoUpdate({
          target: [apiRecords.versionId, apiRecords.collection, apiRecords.slug],
          set: { data: sql`excluded.data`, updatedAt: new Date() },
        });
    }
  });
  await bumpRevision(versionId);
  const updated = mode === "replace" ? 0 : valid.filter((r) => existingSet.has(r.slug)).length;
  const inserted = valid.length - updated;
  await audit({
    apiId: ctx.row.api.id,
    apiSlug: ctx.row.api.slug,
    version: ctx.row.v.version,
    actor,
    action: "record.import",
    summary: mode === "replace" ? `Replaced ${collection} with ${valid.length} imported records.` : `Imported ${collection}: ${inserted} added, ${updated} updated.`,
  });
  return { ok: true, inserted, updated };
}

/* -------------------------------------------------------------- versions */

/** Records that no longer match the schema (after draft edits), by collection. */
export async function invalidRecords(versionId: string, def: DatasetDefinition) {
  const data = await allRecords(versionId);
  const slugs = new Map(def.collections.map((c) => [c.slug, new Set((data[c.slug] ?? []).map((r) => r.slug))]));
  const refExists = (collection: string, slug: string) => slugs.get(collection)?.has(slug) ?? false;
  const out: { collection: string; slug: string; errors: RecordErrors }[] = [];
  for (const c of def.collections) {
    for (const r of data[c.slug] ?? []) {
      const v = validateRecord(c, r, refExists);
      if (!v.ok) out.push({ collection: c.slug, slug: r.slug, errors: v.errors });
    }
  }
  return out;
}

export async function publishVersion(versionId: string, actor: string): Promise<Result> {
  const row = await versionRow(versionId);
  if (!row) return fail("Version not found.");
  if (row.v.state !== "draft") return fail("Only drafts can be published.");
  const def = definitionSchema.parse(row.v.definition);
  if (def.kind === "dataset") {
    const bad = await invalidRecords(versionId, def);
    if (bad.length) return fail(`${bad.length} record${bad.length === 1 ? " doesn't" : "s don't"} match the schema (first: ${bad[0].collection}/${bad[0].slug}). Fix them before publishing.`);
  }
  await getDb().update(apiVersions).set({ state: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(apiVersions.id, versionId));
  await bumpRevision(versionId);
  await audit({ apiId: row.api.id, apiSlug: row.api.slug, version: row.v.version, actor, action: "version.publish", summary: `Published v${row.v.version}.` });
  return { ok: true };
}

const transitions: Record<string, VersionState[]> = {
  published: ["deprecated"],
  deprecated: ["published", "retired"],
  retired: ["deprecated"],
};

export async function setVersionState(versionId: string, state: VersionState, actor: string): Promise<Result> {
  const row = await versionRow(versionId);
  if (!row) return fail("Version not found.");
  if (!transitions[row.v.state]?.includes(state)) return fail(`Can't move v${row.v.version} from ${row.v.state} to ${state}.`);
  await getDb().update(apiVersions).set({ state, updatedAt: new Date() }).where(eq(apiVersions.id, versionId));
  await bumpRevision(versionId);
  const verb = { published: "Restored", deprecated: "Deprecated", retired: "Retired", draft: "Reverted" }[state];
  await audit({ apiId: row.api.id, apiSlug: row.api.slug, version: row.v.version, actor, action: `version.${state}`, summary: `${verb} v${row.v.version}.` });
  return { ok: true };
}

/** Starts the next major version as a draft, copying the latest version's schema and records. */
export async function createNextVersion(apiId: string, actor: string): Promise<Result<number>> {
  const db = getDb();
  const versions = await db.select().from(apiVersions).where(eq(apiVersions.apiId, apiId)).orderBy(desc(apiVersions.version));
  const latest = versions[0];
  if (!latest) return fail("API not found.");
  if (latest.state === "draft") return fail(`v${latest.version} is still a draft. Publish or edit it instead.`);
  const [api] = await db.select().from(apis).where(eq(apis.id, apiId)).limit(1);
  const next = latest.version + 1;
  await db.transaction(async (tx) => {
    const [v] = await tx.insert(apiVersions).values({ apiId, version: next, state: "draft", definition: latest.definition }).returning();
    await tx.execute(sql`
      insert into api_records (version_id, collection, slug, data)
      select ${v.id}, collection, slug, data from api_records where version_id = ${latest.id}
    `);
  });
  await audit({ apiId, apiSlug: api.slug, version: next, actor, action: "version.create", summary: `Started v${next} from v${latest.version}.` });
  return { ok: true, value: next };
}

export async function discardDraft(versionId: string, actor: string): Promise<Result> {
  const row = await versionRow(versionId);
  if (!row) return fail("Version not found.");
  if (row.v.state !== "draft") return fail("Only drafts can be discarded.");
  if (row.v.version === 1) return fail("v1 is the first version; delete the API instead.");
  await getDb().delete(apiVersions).where(eq(apiVersions.id, versionId));
  await audit({ apiId: row.api.id, apiSlug: row.api.slug, version: row.v.version, actor, action: "version.discard", summary: `Discarded the v${row.v.version} draft.` });
  return { ok: true };
}

/** Restores the schema snapshot stored with an audit entry. */
export async function rollbackSchema(auditId: number, actor: string): Promise<Result> {
  const db = getDb();
  const [entry] = await db.select().from(apiAudit).where(eq(apiAudit.id, auditId)).limit(1);
  if (!entry?.before || !entry.apiId || entry.version === null) return fail("This change can't be rolled back.");
  const [v] = await db
    .select()
    .from(apiVersions)
    .where(and(eq(apiVersions.apiId, entry.apiId), eq(apiVersions.version, entry.version)))
    .limit(1);
  if (!v) return fail("That version no longer exists.");
  const res = await saveDefinition(v.id, entry.before, actor);
  if (!res.ok) return res;
  await audit({ apiId: entry.apiId, apiSlug: entry.apiSlug, version: entry.version, actor, action: "schema.rollback", summary: `Rolled the schema back to before change #${auditId}.` });
  return { ok: true };
}

/* -------------------------------------------------------------- built-ins */

/** APIs that ship with Chronon and are served from code until an admin imports them. */
export const BUILTINS = {
  menus: { name: "Regional menus", summary: "Dishes and regional cuisines, filterable by diet, course and spice." },
} as const;

export async function importBuiltin(slug: keyof typeof BUILTINS, actor: string): Promise<Result> {
  const db = getDb();
  const [existing] = await db.select({ id: apis.id }).from(apis).where(eq(apis.slug, slug)).limit(1);
  if (existing) return fail("Already imported.");
  const { regionFiles } = await import("@/apis/menus/data");
  const data = menusRecords(regionFiles);
  await db.transaction(async (tx) => {
    const [api] = await tx.insert(apis).values({ slug, name: BUILTINS[slug].name, summary: BUILTINS[slug].summary, kind: "dataset", createdBy: actor }).returning();
    const [v] = await tx
      .insert(apiVersions)
      .values({ apiId: api.id, version: 1, state: "published", definition: menusDefinition, publishedAt: new Date() })
      .returning();
    for (const [collection, rows] of Object.entries(data)) {
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(apiRecords).values(rows.slice(i, i + 500).map((r) => ({ versionId: v.id, collection, slug: r.slug, data: r.data })));
      }
    }
    await tx.insert(apiAudit).values({ apiId: api.id, apiSlug: slug, version: 1, actor, action: "api.import", summary: `Imported the built-in "${BUILTINS[slug].name}" API with its data.` });
  });
  return { ok: true };
}

export type { BlockDefinition };

/** False until `pnpm db:migrate` has created the builder tables. */
export async function builderReady() {
  try {
    await getDb().select({ id: apis.id }).from(apis).limit(1);
    return true;
  } catch (err) {
    const code = (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
    if (code === "42P01") return false;
    throw err;
  }
}

/** Slugs (and a display name when there's a `name` field) of a collection, for reference pickers. */
export async function referenceOptions(versionId: string, collection: string) {
  const rows = await getDb()
    .select({ slug: apiRecords.slug, name: sql<string | null>`${apiRecords.data}->>'name'` })
    .from(apiRecords)
    .where(and(eq(apiRecords.versionId, versionId), eq(apiRecords.collection, collection)))
    .orderBy(asc(apiRecords.slug));
  return rows;
}
