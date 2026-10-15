import { blockById } from "./blocks";
import type { Collection, DatasetDefinition, Definition, Field, Filter } from "./definition";
import { singular } from "./words";

export { singular };

/**
 * Human-readable description of what a definition serves: endpoints, query
 * parameters and response fields. Drives the admin overview, the generated
 * docs and the OpenAPI document, so all three always agree with the engine.
 */

export type ParamDoc = { name: string; type: string; required: boolean; description: string; example?: string; enum?: string[] };
export type EndpointDoc = { id: string; method: "GET"; path: string; summary: string; params: ParamDoc[]; collection?: string; kind: "list" | "detail" | "random" | "index" | "block" };

function fieldFor(def: DatasetDefinition, c: Collection, path: string): Field | undefined {
  const [head, tail] = path.split(".");
  const slugField = { key: "slug", label: "Slug", type: "text", required: true, description: "" } as Field;
  const f = head === "slug" ? slugField : c.fields.find((x) => x.key === head);
  if (!tail || !f) return f;
  const target = def.collections.find((x) => x.slug === f.target);
  return tail === "slug" ? slugField : target?.fields.find((x) => x.key === tail);
}

export function typeLabel(f: Field): string {
  switch (f.type) {
    case "longtext":
      return "text";
    case "list":
      return f.itemType === "enum" ? "enum[]" : "string[]";
    case "reference":
      return f.embed?.length ? "object" : "slug";
    case "url":
      return "url";
    case "date":
      return "date (YYYY-MM-DD)";
    default:
      return f.type;
  }
}

function filterDoc(def: DatasetDefinition, c: Collection, fl: Filter): ParamDoc {
  const f = fieldFor(def, c, fl.path);
  const values = f && (f.type === "enum" || (f.type === "list" && f.itemType === "enum")) ? f.values : undefined;
  const opText = { eq: "equals", lte: "at most", gte: "at least", contains: "contains" }[fl.op];
  const fallback = `Only records whose \`${fl.path}\` ${opText} this value${fl.caseInsensitive ? " (any case)" : ""}.`;
  return {
    name: fl.param,
    type: f?.type === "integer" || f?.type === "number" ? f.type : f?.type === "boolean" ? "boolean" : values ? "enum" : f?.type === "reference" ? "slug" : "string",
    required: false,
    description: fl.description || fallback,
    enum: values,
  };
}

function queryDocs(def: DatasetDefinition, c: Collection, mode: "list" | "random"): ParamDoc[] {
  const out = c.filters.map((fl) => filterDoc(def, c, fl));
  if (c.search.enabled) out.push({ name: c.search.param, type: "string", required: false, description: `Search ${c.search.fields.map((x) => `\`${x}\``).join(", ")}. Ignores case and accents.` });
  if (mode === "list" && c.list.paginate) {
    out.push({ name: "limit", type: "integer", required: false, description: `Page size, 1–${c.list.maxLimit}. Default ${c.list.defaultLimit}.` });
    out.push({ name: "cursor", type: "string", required: false, description: "The `next_cursor` from the previous page." });
  }
  if (mode === "random") out.push({ name: "count", type: "integer", required: false, description: `How many, 1–${c.random.maxCount}. Default 1.` });
  return out;
}

export function describeEndpoints(def: Definition, api: string, version: number): EndpointDoc[] {
  const base = `/v${version}/${api}`;
  if (def.kind === "block") {
    const block = blockById.get(def.block);
    return block ? [{ id: "run", method: "GET", path: base, summary: block.summary, params: block.params(def.config), kind: "block" }] : [];
  }
  const out: EndpointDoc[] = [];
  for (const c of def.collections) {
    const noun = c.name.toLowerCase();
    if (c.list.enabled) out.push({ id: `${c.slug}-list`, method: "GET", path: `${base}/${c.slug}`, summary: `List ${noun}${c.list.paginate ? ", paginated" : ""}.`, params: queryDocs(def, c, "list"), collection: c.slug, kind: "list" });
    if (c.detail.enabled) out.push({ id: `${c.slug}-detail`, method: "GET", path: `${base}/${c.slug}/{slug}`, summary: `One ${singular(c.name)} by slug${c.detail.include.length ? `, with ${c.detail.include.map((i) => i.as).join(", ")}` : ""}.`, params: [], collection: c.slug, kind: "detail" });
    if (c.random.enabled) out.push({ id: `${c.slug}-random`, method: "GET", path: `${base}/${c.slug}/random`, summary: `Random ${noun}, with the same filters as the list.`, params: queryDocs(def, c, "random"), collection: c.slug, kind: "random" });
  }
  if (def.randomAlias) {
    const c = def.collections.find((x) => x.slug === def.randomAlias);
    if (c) out.push({ id: "random", method: "GET", path: `${base}/random`, summary: `Shortcut for ${base}/${c.slug}/random.`, params: queryDocs(def, c, "random"), collection: c.slug, kind: "random" });
  }
  return out;
}

export type FieldDoc = { name: string; type: string; nullable: boolean; description: string };

/** The fields of a record as the API returns them. */
export function responseFields(def: DatasetDefinition, c: Collection): FieldDoc[] {
  const out: FieldDoc[] = [{ name: "slug", type: "string", nullable: false, description: "Unique, URL-safe identifier." }];
  for (const f of c.fields) {
    let description = f.description || f.label;
    if (f.type === "enum" && f.values) description += ` One of: ${f.values.join(", ")}.`;
    if (f.type === "reference") description += f.embed?.length ? ` Embedded ${f.target}: ${f.embed.join(", ")}.` : ` Slug of a ${f.target} record.`;
    if ((f.type === "integer" || f.type === "number") && (f.min !== undefined || f.max !== undefined)) description += ` Range ${f.min ?? "…"}–${f.max ?? "…"}.`;
    out.push({ name: f.key, type: typeLabel(f), nullable: !f.required && f.type !== "list", description });
  }
  for (const n of c.counts) out.push({ name: n.key, type: "integer", nullable: false, description: `Number of ${n.collection} records linked through \`${n.via}\`.` });
  return out;
}
