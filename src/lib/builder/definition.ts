import { z } from "zod";

/**
 * The definition of a builder API, stored per version as JSON.
 *
 * A dataset API is a set of collections (e.g. regions, dishes). Each collection
 * has typed fields, and declares how it is served: sorting, pagination,
 * filters, search, a random endpoint, computed counts and related lists.
 * A block API is a pre-built utility (QR codes, hashing…) with a config.
 */

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

const slug = z.string().regex(SLUG_RE, "lowercase-kebab-case").max(48);
const key = z.string().regex(KEY_RE, "lowercase_snake_case, starts with a letter").max(40);

export const FIELD_TYPES = ["text", "longtext", "integer", "number", "boolean", "enum", "list", "date", "url", "reference"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const fieldSchema = z.object({
  key,
  label: z.string().min(1).max(60),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  description: z.string().max(240).default(""),
  /** text / longtext / list items */
  maxLength: z.number().int().positive().max(20000).optional(),
  /** text: regex the value must match */
  pattern: z.string().max(200).optional(),
  /** integer / number */
  min: z.number().optional(),
  max: z.number().optional(),
  /** enum, or list of enum */
  values: z.array(z.string().min(1).max(60)).max(200).optional(),
  /** list: type of each item */
  itemType: z.enum(["text", "enum"]).optional(),
  /** reference: target collection slug, and which of its fields to embed in responses */
  target: slug.optional(),
  embed: z.array(z.string()).max(12).optional(),
});
export type Field = z.infer<typeof fieldSchema>;

export const FILTER_OPS = ["eq", "lte", "gte", "contains"] as const;

export const filterSchema = z.object({
  /** Query-string parameter, e.g. "country". */
  param: key,
  /** Field path: "course", or through a reference: "region.country_code". */
  path: z.string().min(1).max(80),
  op: z.enum(FILTER_OPS).default("eq"),
  /** Compare case-insensitively (the value is upper-cased if the field is). */
  caseInsensitive: z.boolean().default(false),
  /**
   * Enum filters only: what each value also matches. e.g. vegetarian → [vegan,
   * vegetarian] makes ?diet=vegetarian return dishes suitable for vegetarians.
   */
  implies: z.record(z.string(), z.array(z.string())).optional(),
  description: z.string().max(240).default(""),
});
export type Filter = z.infer<typeof filterSchema>;

export const collectionSchema = z.object({
  slug,
  name: z.string().min(1).max(60),
  description: z.string().max(400).default(""),
  fields: z.array(fieldSchema).max(60),
  /** Records are ordered by these fields (locale-aware for text). */
  sort: z.array(z.object({ field: z.string(), dir: z.enum(["asc", "desc"]).default("asc") })).max(4).default([]),
  list: z
    .object({
      enabled: z.boolean().default(true),
      paginate: z.boolean().default(true),
      defaultLimit: z.number().int().min(1).max(100).default(20),
      maxLimit: z.number().int().min(1).max(100).default(100),
    })
    .default({ enabled: true, paginate: true, defaultLimit: 20, maxLimit: 100 }),
  detail: z
    .object({
      enabled: z.boolean().default(true),
      /** Related records listed in the detail response, e.g. a region's dishes. */
      include: z
        .array(z.object({ collection: slug, via: key, as: key, omitVia: z.boolean().default(true) }))
        .max(4)
        .default([]),
    })
    .default({ enabled: true, include: [] }),
  random: z.object({ enabled: z.boolean().default(false), maxCount: z.number().int().min(1).max(50).default(10) }).default({ enabled: false, maxCount: 10 }),
  filters: z.array(filterSchema).max(20).default([]),
  search: z
    .object({ enabled: z.boolean().default(false), param: key.default("q"), fields: z.array(z.string()).max(12).default([]) })
    .default({ enabled: false, param: "q", fields: [] }),
  /** Computed counts, e.g. dish_count = number of dishes whose `region` is this record. */
  counts: z.array(z.object({ key, collection: slug, via: key })).max(6).default([]),
});
export type Collection = z.infer<typeof collectionSchema>;

export const datasetDefinitionSchema = z.object({
  kind: z.literal("dataset"),
  collections: z.array(collectionSchema).min(1).max(8),
  /** Optional shortcut: /v1/<api>/random serves this collection's random endpoint. */
  randomAlias: slug.nullable().default(null),
});
export type DatasetDefinition = z.infer<typeof datasetDefinitionSchema>;

export const blockDefinitionSchema = z.object({
  kind: z.literal("block"),
  block: z.string().min(1).max(40),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type BlockDefinition = z.infer<typeof blockDefinitionSchema>;

export const definitionSchema = z.discriminatedUnion("kind", [datasetDefinitionSchema, blockDefinitionSchema]);
export type Definition = z.infer<typeof definitionSchema>;

/** Platform limits, sized for free-tier Postgres. */
export const LIMITS = {
  apis: 25,
  recordsPerApi: 10_000,
  recordBytes: 32 * 1024,
} as const;

/**
 * Cross-reference checks the Zod schema can't express: unique keys and slugs,
 * references to real collections and fields, filters and search on real paths.
 * Returns human-readable problems; empty means valid.
 */
export function checkDataset(def: DatasetDefinition): string[] {
  const problems: string[] = [];
  const bySlug = new Map(def.collections.map((c) => [c.slug, c]));
  if (bySlug.size !== def.collections.length) problems.push("Collection slugs must be unique.");

  const fieldOf = (c: Collection, k: string) => (k === "slug" ? ({ key: "slug", type: "text" } as Field) : c.fields.find((f) => f.key === k));
  const resolvePath = (c: Collection, path: string): Field | undefined => {
    const [head, tail] = path.split(".");
    const f = fieldOf(c, head);
    if (!f) return undefined;
    if (!tail) return f;
    if (f.type !== "reference" || !f.target) return undefined;
    const target = bySlug.get(f.target);
    return target ? fieldOf(target, tail) : undefined;
  };

  for (const c of def.collections) {
    const keys = new Set<string>();
    for (const f of c.fields) {
      if (f.key === "slug") problems.push(`${c.slug}: "slug" is built in; don't add it as a field.`);
      if (keys.has(f.key)) problems.push(`${c.slug}: duplicate field "${f.key}".`);
      keys.add(f.key);
      if ((f.type === "enum" || (f.type === "list" && f.itemType === "enum")) && !f.values?.length) {
        problems.push(`${c.slug}.${f.key}: list the allowed values.`);
      }
      if (f.type === "reference") {
        const target = f.target ? bySlug.get(f.target) : undefined;
        if (!target) problems.push(`${c.slug}.${f.key}: reference target "${f.target ?? ""}" doesn't exist.`);
        else for (const e of f.embed ?? []) if (!fieldOf(target, e)) problems.push(`${c.slug}.${f.key}: can't embed unknown field "${e}".`);
      }
      if (f.min !== undefined && f.max !== undefined && f.min > f.max) problems.push(`${c.slug}.${f.key}: min is above max.`);
    }
    for (const s of c.sort) if (!fieldOf(c, s.field)) problems.push(`${c.slug}: can't sort by unknown field "${s.field}".`);
    const params = new Set<string>();
    for (const fl of c.filters) {
      if (params.has(fl.param)) problems.push(`${c.slug}: duplicate filter parameter "${fl.param}".`);
      params.add(fl.param);
      if (!resolvePath(c, fl.path)) problems.push(`${c.slug}: filter "${fl.param}" points at unknown field "${fl.path}".`);
    }
    if (c.search.enabled) {
      if (params.has(c.search.param)) problems.push(`${c.slug}: search parameter "${c.search.param}" clashes with a filter.`);
      for (const p of c.search.fields) if (!resolvePath(c, p)) problems.push(`${c.slug}: search field "${p}" doesn't exist.`);
    }
    for (const n of c.counts) {
      const other = bySlug.get(n.collection);
      const via = other ? fieldOf(other, n.via) : undefined;
      if (!via || via.type !== "reference" || via.target !== c.slug) {
        problems.push(`${c.slug}: count "${n.key}" needs a reference from "${n.collection}" back to "${c.slug}".`);
      }
      if (keys.has(n.key)) problems.push(`${c.slug}: count "${n.key}" clashes with a field.`);
    }
    for (const inc of c.detail.include) {
      const other = bySlug.get(inc.collection);
      const via = other ? fieldOf(other, inc.via) : undefined;
      if (!via || via.type !== "reference" || via.target !== c.slug) {
        problems.push(`${c.slug}: related list "${inc.as}" needs a reference from "${inc.collection}" back to "${c.slug}".`);
      }
    }
  }
  if (def.randomAlias) {
    const target = bySlug.get(def.randomAlias);
    if (!target) problems.push(`Random shortcut points at unknown collection "${def.randomAlias}".`);
    else if (!target.random.enabled) problems.push(`Random shortcut needs random enabled on "${def.randomAlias}".`);
  }
  return problems;
}
