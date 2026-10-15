import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { apiError, apiJson, CORS_HEADERS } from "@/lib/api/respond";
import { defer, withApiKey } from "@/lib/api/with-api-key";
import { getDb } from "@/lib/db";
import { apiRecords, apis, apiVersions } from "@/lib/db/schema";
import { getLimitStore } from "@/lib/ratelimit";
import { site } from "@/lib/site";
import { blockById, type Block } from "./blocks";
import { definitionSchema } from "./definition";
import { handleDataset, prepare, type DatasetData, type EngineResult, type Prepared } from "./engine";
import { menusDefinition, menusRecords } from "./seeds/menus";

/**
 * Serves builder APIs at /v{n}/<api>/…: loads the definition and records
 * (cached per instance), applies the version's lifecycle and runs the engine
 * or block.
 */

type Loaded =
  | { kind: "dataset"; prepared: Prepared }
  | { kind: "block"; block: Block; settings: Record<string, unknown> };

export type ServedVersion = {
  slug: string;
  name: string;
  version: number;
  state: "published" | "deprecated" | "retired";
  /** Newest published version, for Deprecation/successor links. */
  latest: number;
  load: () => Promise<Loaded>;
};

type CatalogEntry = { slug: string; name: string; summary: string; kind: string; versions: { id: string; version: number; state: string; revision: number }[] };

const CATALOG_TTL_MS = 15_000;
type ServeCache = { catalog?: { at: number; entries: Map<string, CatalogEntry> }; loaded: Map<string, { revision: number; value: Loaded }> };
// On globalThis so admin server actions can clear the cache the routes read.
const globalForServe = globalThis as unknown as { chrononServe?: ServeCache };
const cache: ServeCache = (globalForServe.chrononServe ??= { loaded: new Map() });

/** Drops cached definitions on this instance (others refresh within 15 seconds). */
export function clearServeCache() {
  cache.catalog = undefined;
}

/** APIs and versions from the database, or null if the builder tables don't exist yet. */
async function catalog(): Promise<Map<string, CatalogEntry> | null> {
  const now = Date.now();
  if (cache.catalog && now - cache.catalog.at < CATALOG_TTL_MS) return cache.catalog.entries;
  try {
    const db = getDb();
    const [rows, versions] = await Promise.all([
      db.select({ id: apis.id, slug: apis.slug, name: apis.name, summary: apis.summary, kind: apis.kind, status: apis.status }).from(apis),
      db
        .select({ id: apiVersions.id, apiId: apiVersions.apiId, version: apiVersions.version, state: apiVersions.state, revision: apiVersions.revision })
        .from(apiVersions),
    ]);
    const entries = new Map<string, CatalogEntry>();
    for (const a of rows) {
      if (a.status !== "active") {
        entries.set(a.slug, { ...a, versions: [] });
        continue;
      }
      entries.set(a.slug, { ...a, versions: versions.filter((v) => v.apiId === a.id && v.state !== "draft").sort((x, y) => x.version - y.version) });
    }
    cache.catalog = { at: now, entries };
    return entries;
  } catch (err) {
    // Before `pnpm db:migrate` adds the builder tables, built-in APIs still serve from code.
    if (String((err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code) === "42P01") return null;
    throw err;
  }
}

let builtinMenus: Loaded | undefined;
async function loadBuiltinMenus(): Promise<Loaded> {
  if (!builtinMenus) {
    const { regionFiles } = await import("@/apis/menus/data");
    builtinMenus = { kind: "dataset", prepared: prepare(menusDefinition, menusRecords(regionFiles)) };
  }
  return builtinMenus;
}

async function loadFromDb(entry: CatalogEntry, v: CatalogEntry["versions"][number]): Promise<Loaded> {
  const key = v.id;
  const hit = cache.loaded.get(key);
  if (hit && hit.revision === v.revision) return hit.value;

  const db = getDb();
  const [row] = await db.select({ definition: apiVersions.definition }).from(apiVersions).where(eq(apiVersions.id, v.id)).limit(1);
  const def = definitionSchema.parse(row.definition);
  let value: Loaded;
  if (def.kind === "block") {
    const block = blockById.get(def.block);
    if (!block) throw new Error(`Unknown block ${def.block} in ${entry.slug} v${v.version}`);
    value = { kind: "block", block, settings: def.config };
  } else {
    const rows = await db
      .select({ collection: apiRecords.collection, slug: apiRecords.slug, data: apiRecords.data })
      .from(apiRecords)
      .where(and(eq(apiRecords.versionId, v.id), inArray(apiRecords.collection, def.collections.map((c) => c.slug))));
    const data: DatasetData = {};
    for (const r of rows) (data[r.collection] ??= []).push({ slug: r.slug, data: r.data as Record<string, unknown> });
    value = { kind: "dataset", prepared: prepare(def, data) };
  }
  if (cache.loaded.size > 200) cache.loaded.clear();
  cache.loaded.set(key, { revision: v.revision, value });
  return value;
}

/** Resolves /v{version}/<slug>; null when no such API version is served. */
export async function resolve(slug: string, version: number): Promise<ServedVersion | null> {
  const entries = await catalog();
  const entry = entries?.get(slug);
  if (!entry) {
    if (slug === "menus" && version === 1) {
      return { slug, name: "Regional menus", version: 1, state: "published", latest: 1, load: loadBuiltinMenus };
    }
    return null;
  }
  const v = entry.versions.find((x) => x.version === version);
  if (!v) return null;
  const live = entry.versions.filter((x) => x.state === "published");
  return {
    slug,
    name: entry.name,
    version,
    state: v.state as ServedVersion["state"],
    latest: live.length ? live[live.length - 1].version : version,
    load: () => loadFromDb(entry, v),
  };
}

/** Published APIs for the /v{n} index and docs. */
export async function servedApis(version: number) {
  const entries = await catalog();
  const out: { slug: string; name: string; summary: string; kind: string; state: string }[] = [];
  if (!entries?.has("menus") && version === 1) out.push({ slug: "menus", name: "Regional menus", summary: "Dishes and regional cuisines.", kind: "dataset", state: "published" });
  for (const e of entries?.values() ?? []) {
    const v = e.versions.find((x) => x.version === version);
    if (v && v.state !== "retired") out.push({ slug: e.slug, name: e.name, summary: e.summary, kind: e.kind, state: v.state });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* --------------------------------------------------------------- running */

export type RunOutput =
  | { status: number; body: unknown }
  | { status: number; raw: string; contentType: string }
  | { status: number; error: { code: "invalid_request" | "not_found"; message: string } };

/** Runs a request against a loaded API. Shared by the public routes and the admin playground. */
export async function run(loaded: Loaded, segments: string[], params: URLSearchParams, apiPath: string): Promise<RunOutput> {
  if (loaded.kind === "dataset") return handleDataset(loaded.prepared, segments, params, apiPath) as EngineResult;
  if (segments.length) return { status: 404, error: { code: "not_found", message: `Unknown endpoint. This API is served at ${apiPath}.` } };
  return loaded.block.run(params, loaded.settings);
}

function toResponse(out: RunOutput, headers: Record<string, string>) {
  if ("error" in out) return apiError(out.status, out.error.code, out.error.message, headers);
  if ("raw" in out) {
    return new Response(out.raw, { status: out.status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store", "Content-Type": out.contentType, ...headers } });
  }
  return apiJson(out.body, { status: out.status, headers });
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Request counts per API per day, kept 35 days, for the admin overview. */
export async function apiUsage(slugs: string[], days = 7) {
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
  const keys = slugs.flatMap((s) => dates.map((d) => `api:${s}:${d}`));
  const values = await getLimitStore().readCounters(keys);
  const out = new Map<string, { date: string; count: number }[]>();
  slugs.forEach((s, i) => out.set(s, dates.map((date, j) => ({ date, count: values[i * days + j] ?? 0 }))));
  return out;
}

/** The route handler for /v{version}/… beyond the hand-written routes. */
export async function serveRequest(req: NextRequest, version: number, path: string[]) {
  const [slug, ...segments] = path;
  if (!slug) return apiError(404, "not_found", `Unknown endpoint. See GET /v${version} for the list.`);
  const served = await resolve(slug, version);
  if (!served) {
    return apiError(404, "not_found", `Unknown endpoint. See GET /v${version} for the list.`);
  }
  if (served.state === "retired") {
    return apiError(410, "gone", `v${version} of ${served.name} was retired.${served.latest > version ? ` Use /v${served.latest}/${slug}.` : ""}`);
  }

  const handler = withApiKey(async () => {
    const out = await run(await served.load(), segments, req.nextUrl.searchParams, `/v${version}/${slug}`);
    const headers: Record<string, string> = {};
    if (served.state === "deprecated") {
      headers.Deprecation = "true";
      if (served.latest > version) headers.Link = `<${site.url}/v${served.latest}/${slug}>; rel="successor-version"`;
    }
    defer(() => getLimitStore().bump(`api:${slug}:${dayKey()}`, 35 * 86_400));
    return toResponse(out, headers);
  });
  return handler(req, { params: Promise.resolve({}) });
}

/** Loads any version (drafts included) without caching, for the admin playground. */
export async function loadForPreview(versionId: string): Promise<Loaded> {
  const db = getDb();
  const [row] = await db.select({ definition: apiVersions.definition }).from(apiVersions).where(eq(apiVersions.id, versionId)).limit(1);
  if (!row) throw new Error("Version not found");
  const def = definitionSchema.parse(row.definition);
  if (def.kind === "block") {
    const block = blockById.get(def.block);
    if (!block) throw new Error(`Unknown block ${def.block}`);
    return { kind: "block", block, settings: def.config };
  }
  const rows = await db.select({ collection: apiRecords.collection, slug: apiRecords.slug, data: apiRecords.data }).from(apiRecords).where(eq(apiRecords.versionId, versionId));
  const data: DatasetData = {};
  for (const r of rows) (data[r.collection] ??= []).push({ slug: r.slug, data: r.data as Record<string, unknown> });
  return { kind: "dataset", prepared: prepare(def, data) };
}

/** The built-in menus API, for previews before it's imported. */
export const loadBuiltin = loadBuiltinMenus;
