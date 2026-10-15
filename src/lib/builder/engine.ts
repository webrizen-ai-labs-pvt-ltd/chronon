import { z } from "zod";
import { SLUG_RE, type Collection, type DatasetDefinition, type Field, type Filter } from "./definition";

/**
 * Serves a dataset API from in-memory records. Pure: no database, no HTTP. The
 * route layer loads (and caches) records, then calls `handleDataset`.
 */

export type RecordRow = { slug: string; data: Record<string, unknown> };
export type DatasetData = Record<string, RecordRow[]>; // by collection slug

export type EngineResult = { status: number; body: unknown } | { status: number; error: { code: "invalid_request" | "not_found"; message: string } };

/** Lowercase and strip accents so "tiramisu" finds "Tiramisù". */
export function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function encodeCursor(offset: number) {
  return Buffer.from(`o:${offset}`).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): number | null {
  if (!cursor) return 0;
  const m = Buffer.from(cursor, "base64url").toString().match(/^o:(\d{1,6})$/);
  return m ? Number(m[1]) : null;
}

/* ----------------------------------------------------------------- prepared */

export type Prepared = {
  def: DatasetDefinition;
  collections: Map<string, Collection>;
  rows: Map<string, RecordRow[]>; // sorted by each collection's sort spec
  bySlug: Map<string, Map<string, RecordRow>>;
  /** collection → via field → target slug → rows referencing it */
  backrefs: Map<string, Map<string, Map<string, RecordRow[]>>>;
};

const collator = new Intl.Collator(undefined);

function compareValues(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(String(a), String(b));
}

export function prepare(def: DatasetDefinition, data: DatasetData): Prepared {
  const collections = new Map(def.collections.map((c) => [c.slug, c]));
  const rows = new Map<string, RecordRow[]>();
  const bySlug = new Map<string, Map<string, RecordRow>>();
  for (const c of def.collections) {
    const list = [...(data[c.slug] ?? [])];
    const field = (r: RecordRow, k: string) => (k === "slug" ? r.slug : r.data[k]);
    if (c.sort.length) {
      list.sort((a, b) => {
        for (const s of c.sort) {
          const d = compareValues(field(a, s.field), field(b, s.field));
          if (d !== 0) return s.dir === "desc" ? -d : d;
        }
        return 0;
      });
    }
    rows.set(c.slug, list);
    bySlug.set(c.slug, new Map(list.map((r) => [r.slug, r])));
  }
  const backrefs = new Map<string, Map<string, Map<string, RecordRow[]>>>();
  for (const c of def.collections) {
    const perField = new Map<string, Map<string, RecordRow[]>>();
    for (const f of c.fields) {
      if (f.type !== "reference") continue;
      const idx = new Map<string, RecordRow[]>();
      for (const r of rows.get(c.slug) ?? []) {
        const target = r.data[f.key];
        if (typeof target !== "string") continue;
        const bucket = idx.get(target);
        if (bucket) bucket.push(r);
        else idx.set(target, [r]);
      }
      perField.set(f.key, idx);
    }
    backrefs.set(c.slug, perField);
  }
  return { def, collections, rows, bySlug, backrefs };
}

/* ------------------------------------------------------------------- output */

function valueOf(p: Prepared, c: Collection, r: RecordRow, path: string): unknown {
  const [head, tail] = path.split(".");
  if (head === "slug") return r.slug;
  const v = r.data[head];
  if (!tail) return v;
  const f = c.fields.find((x) => x.key === head);
  if (!f?.target || typeof v !== "string") return undefined;
  const target = p.bySlug.get(f.target)?.get(v);
  if (!target) return undefined;
  return tail === "slug" ? target.slug : target.data[tail];
}

/** A record as the API returns it: slug, then fields in order, then counts. */
function present(p: Prepared, c: Collection, r: RecordRow, omit?: string): Record<string, unknown> {
  const out: Record<string, unknown> = { slug: r.slug };
  for (const f of c.fields) {
    if (f.key === omit) continue;
    const v = r.data[f.key];
    if (f.type === "reference") {
      if (typeof v !== "string") {
        out[f.key] = null;
        continue;
      }
      if (!f.embed?.length) {
        out[f.key] = v;
        continue;
      }
      const target = f.target ? p.bySlug.get(f.target)?.get(v) : undefined;
      if (!target) {
        out[f.key] = null;
        continue;
      }
      const emb: Record<string, unknown> = {};
      for (const k of f.embed) emb[k] = k === "slug" ? target.slug : (target.data[k] ?? null);
      out[f.key] = emb;
    } else {
      out[f.key] = v === undefined ? null : v;
    }
  }
  for (const n of c.counts) out[n.key] = p.backrefs.get(n.collection)?.get(n.via)?.get(r.slug)?.length ?? 0;
  return out;
}

/* ---------------------------------------------------------------- filtering */

function fieldAt(p: Prepared, c: Collection, path: string): Field | undefined {
  const [head, tail] = path.split(".");
  const f = head === "slug" ? ({ key: "slug", type: "text" } as Field) : c.fields.find((x) => x.key === head);
  if (!tail || !f) return f;
  const target = f.target ? p.collections.get(f.target) : undefined;
  if (!target) return undefined;
  return tail === "slug" ? ({ key: "slug", type: "text" } as Field) : target.fields.find((x) => x.key === tail);
}

/** Zod schema for one filter parameter, derived from the field it targets. */
function filterParam(p: Prepared, c: Collection, fl: Filter) {
  const f = fieldAt(p, c, fl.path);
  if (!f) return z.string().optional();
  if (f.type === "integer" || f.type === "number") {
    let n = z.coerce.number();
    if (f.type === "integer") n = n.int();
    if (f.min !== undefined) n = n.min(f.min);
    if (f.max !== undefined) n = n.max(f.max);
    return n.optional();
  }
  if (f.type === "boolean") return z.enum(["true", "false"]).transform((v) => v === "true").optional();
  const values = f.type === "enum" || (f.type === "list" && f.itemType === "enum") ? f.values : undefined;
  if (values?.length) {
    if (fl.caseInsensitive) {
      const lower = new Map(values.map((v) => [v.toLowerCase(), v]));
      return z
        .string()
        .transform((v, ctx) => {
          const hit = lower.get(v.toLowerCase());
          if (!hit) ctx.addIssue({ code: "custom", message: `expected one of ${values.map((x) => `"${x}"`).join("|")}` });
          return hit ?? v;
        })
        .optional();
    }
    return z.enum(values as [string, ...string[]]).optional();
  }
  if (f.type === "reference" || f.key === "slug") return z.string().regex(SLUG_RE, "lowercase-kebab-case").max(48).optional();
  let s = z.string().trim().min(1).max(120);
  if (f.pattern) {
    const re = new RegExp(f.pattern, fl.caseInsensitive ? "i" : "");
    s = s.regex(re, `doesn't match ${f.pattern}`);
  }
  return s.optional();
}

function matches(p: Prepared, c: Collection, r: RecordRow, fl: Filter, wanted: unknown) {
  const actual = valueOf(p, c, r, fl.path);
  const ci = fl.caseInsensitive;
  const eq = (a: unknown, b: unknown) => (ci && typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (fl.op === "lte") return typeof actual === "number" && typeof wanted === "number" && actual <= wanted;
  if (fl.op === "gte") return typeof actual === "number" && typeof wanted === "number" && actual >= wanted;
  if (fl.op === "contains") {
    if (Array.isArray(actual)) return actual.some((x) => eq(x, wanted));
    return typeof actual === "string" && typeof wanted === "string" && normalize(actual).includes(normalize(wanted));
  }
  if (fl.implies && typeof wanted === "string") {
    const accepted = fl.implies[wanted] ?? [wanted];
    return Array.isArray(actual) ? actual.some((x) => accepted.includes(String(x))) : accepted.includes(String(actual));
  }
  if (Array.isArray(actual)) return actual.some((x) => eq(x, wanted));
  return eq(actual, wanted);
}

type ParsedQuery = { filters: [Filter, unknown][]; q: string | null; limit: number; offset: number; count: number };

function parseQuery(
  p: Prepared,
  c: Collection,
  params: URLSearchParams,
  mode: "list" | "random",
): { ok: true; value: ParsedQuery } | { ok: false; message: string } {
  const shape: Record<string, z.ZodType> = {};
  for (const fl of c.filters) shape[fl.param] = filterParam(p, c, fl);
  if (c.search.enabled) shape[c.search.param] = z.string().trim().min(1).max(64).optional();
  if (mode === "list" && c.list.paginate) {
    shape.limit = z.coerce.number().int().min(1).max(c.list.maxLimit).default(c.list.defaultLimit);
    shape.cursor = z.string().max(32).optional();
  }
  if (mode === "random") shape.count = z.coerce.number().int().min(1).max(c.random.maxCount).default(1);

  const parsed = z.object(shape).safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Invalid \`${issue?.path.join(".") || "query"}\`: ${issue?.message ?? "bad value"}.` };
  }
  const v = parsed.data as Record<string, unknown>;
  const offset = decodeCursor(v.cursor as string | undefined);
  if (offset === null) return { ok: false, message: "Invalid `cursor`. Use the `next_cursor` from the previous page." };
  return {
    ok: true,
    value: {
      filters: c.filters.filter((fl) => v[fl.param] !== undefined).map((fl) => [fl, v[fl.param]]),
      q: c.search.enabled ? ((v[c.search.param] as string | undefined) ?? null) : null,
      limit: (v.limit as number | undefined) ?? Number.POSITIVE_INFINITY,
      offset,
      count: (v.count as number | undefined) ?? 1,
    },
  };
}

function select(p: Prepared, c: Collection, q: ParsedQuery) {
  const needle = q.q ? normalize(q.q) : null;
  return (p.rows.get(c.slug) ?? []).filter((r) => {
    for (const [fl, wanted] of q.filters) if (!matches(p, c, r, fl, wanted)) return false;
    if (needle) {
      const hay = c.search.fields
        .flatMap((path) => {
          const v = valueOf(p, c, r, path);
          return Array.isArray(v) ? v.map(String) : [v === null || v === undefined ? "" : String(v)];
        })
        .join(" ");
      if (!normalize(hay).includes(needle)) return false;
    }
    return true;
  });
}

export function pickRandom<T>(items: T[], count: number, random = Math.random): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}

/* ------------------------------------------------------------------ routing */

const notFound = (message: string): EngineResult => ({ status: 404, error: { code: "not_found", message } });
const invalid = (message: string): EngineResult => ({ status: 400, error: { code: "invalid_request", message } });

/**
 * Handles a request below /v{n}/<api>/. `segments` is the remaining path:
 *   []                         index of collections
 *   [collection]               list
 *   [collection, "random"]     random records
 *   [collection, slug]         one record
 *   ["random"]                 random shortcut (randomAlias)
 */
export function handleDataset(p: Prepared, segments: string[], params: URLSearchParams, apiPath: string): EngineResult {
  const [first, second, ...rest] = segments;
  if (rest.length) return notFound("Unknown endpoint.");

  if (!first) {
    return {
      status: 200,
      body: {
        collections: p.def.collections.map((c) => ({
          slug: c.slug,
          name: c.name,
          description: c.description,
          endpoints: [
            c.list.enabled ? `${apiPath}/${c.slug}` : null,
            c.detail.enabled ? `${apiPath}/${c.slug}/{slug}` : null,
            c.random.enabled ? `${apiPath}/${c.slug}/random` : null,
          ].filter(Boolean),
        })),
      },
    };
  }

  if (first === "random" && !second && p.def.randomAlias && !p.collections.has("random")) {
    return random(p, p.collections.get(p.def.randomAlias)!, params);
  }

  const c = p.collections.get(first);
  if (!c) return notFound("Unknown endpoint.");

  if (!second) {
    if (!c.list.enabled) return notFound("Unknown endpoint.");
    const q = parseQuery(p, c, params, "list");
    if (!q.ok) return invalid(q.message);
    const matched = select(p, c, q.value);
    const data = c.list.paginate ? matched.slice(q.value.offset, q.value.offset + q.value.limit) : matched;
    const body: Record<string, unknown> = { data: data.map((r) => present(p, c, r)), total: matched.length };
    if (c.list.paginate) body.next_cursor = q.value.offset + q.value.limit < matched.length ? encodeCursor(q.value.offset + q.value.limit) : null;
    return { status: 200, body };
  }

  if (second === "random" && c.random.enabled) return random(p, c, params);

  if (!c.detail.enabled) return notFound("Unknown endpoint.");
  const r = p.bySlug.get(c.slug)?.get(second);
  if (!r) return notFound(`No ${c.name.toLowerCase()} record called "${second}". List them at ${apiPath}/${c.slug}.`);
  const out = present(p, c, r);
  for (const inc of c.detail.include) {
    const other = p.collections.get(inc.collection);
    const related = p.backrefs.get(inc.collection)?.get(inc.via)?.get(r.slug) ?? [];
    out[inc.as] = other ? related.map((x) => present(p, other, x, inc.omitVia ? inc.via : undefined)) : [];
  }
  return { status: 200, body: { data: out } };
}

function random(p: Prepared, c: Collection, params: URLSearchParams): EngineResult {
  const q = parseQuery(p, c, params, "random");
  if (!q.ok) return invalid(q.message);
  const matched = select(p, c, q.value);
  if (matched.length === 0) return notFound(`No ${c.name.toLowerCase()} match those filters.`);
  return { status: 200, body: { data: pickRandom(matched, q.value.count).map((r) => present(p, c, r)) } };
}
