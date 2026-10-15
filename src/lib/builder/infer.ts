import { checkDataset, datasetDefinitionSchema, LIMITS, type Collection, type DatasetDefinition, type Field, type FieldType } from "./definition";
import { fromCell, type RecordInput } from "./records";
import { slugify, toKey } from "./words";

/**
 * Turns spreadsheets into a builder API. `planWorkbook` reads the sheets and
 * proposes collections, field types, record ids and links between sheets; the
 * admin adjusts that plan; `buildFromPlan` turns it into a definition plus
 * records, reporting every cell that doesn't fit. Pure: runs in the browser.
 */

export type Cell = string | number | boolean | Date | null;
export type RawSheet = { name: string; rows: Cell[][] };

export type ColumnPlan = {
  index: number;
  header: string;
  include: boolean;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  itemType?: "text" | "enum";
  values?: string[];
  /** list: the separator found in the cells */
  separator?: string;
  /** reference: name of the target sheet */
  targetSheet?: string;
  stats: { filled: number; distinct: number; samples: string[] };
};

export type IdSource = { kind: "column"; index: number } | { kind: "name"; index: number } | { kind: "row" };

export type SheetPlan = {
  name: string;
  include: boolean;
  slug: string;
  collectionName: string;
  headerRow: number;
  id: IdSource;
  columns: ColumnPlan[];
  rowCount: number;
};

export type Plan = { sheets: SheetPlan[] };

export type Issue = { sheet: string; row: number; column: string; message: string };

/* ------------------------------------------------------------------ cells */

const NULLISH = new Set(["", "-", "—", "–", "n/a", "na", "null", "none", "nil", "#n/a", "undefined"]);

export function clean(c: Cell | undefined): Cell {
  if (c === undefined || c === null) return null;
  if (typeof c === "string") {
    const s = c.replace(/\r\n/g, "\n").trim();
    return NULLISH.has(s.toLowerCase()) ? null : s;
  }
  if (typeof c === "number" && !Number.isFinite(c)) return null;
  if (c instanceof Date && Number.isNaN(c.getTime())) return null;
  return c;
}

/** Display text for a cell (samples, slugs, enum values). */
export function cellText(c: Cell): string {
  if (c === null) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c);
}

const INT_RE = /^-?\d+$/;
const NUM_RE = /^-?(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;
const TRUE = new Set(["true", "yes", "y"]);
const FALSE = new Set(["false", "no", "n"]);

const asNumber = (c: Cell): number | null => {
  if (typeof c === "number") return c;
  if (typeof c === "string" && NUM_RE.test(c)) return Number(c.replace(/,/g, ""));
  return null;
};
const asBool = (c: Cell): boolean | null => {
  if (typeof c === "boolean") return c;
  if (typeof c === "string") {
    const l = c.toLowerCase();
    if (TRUE.has(l)) return true;
    if (FALSE.has(l)) return false;
  }
  return null;
};
const asDate = (c: Cell): string | null => {
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  if (typeof c === "string" && DATE_RE.test(c) && !Number.isNaN(Date.parse(`${c}T00:00:00Z`))) return c;
  return null;
};

const SEPARATORS = ["|", ";", ",", "\n"];
const LIMITS_FIELDS = 60;

function splitList(c: Cell, sep: string): string[] {
  return cellText(c)
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ---------------------------------------------------------------- columns */

function inferColumn(index: number, header: string, cells: Cell[]): Omit<ColumnPlan, "key"> {
  const filled = cells.filter((c) => c !== null) as Exclude<Cell, null>[];
  const texts = filled.map(cellText);
  const distinct = new Set(texts);
  const base = {
    index,
    header,
    include: true,
    label: header.trim() || `Column ${index + 1}`,
    required: filled.length === cells.length && cells.length > 0,
    stats: { filled: filled.length, distinct: distinct.size, samples: [...distinct].slice(0, 4).map((s) => (s.length > 60 ? `${s.slice(0, 57)}…` : s)) },
  };
  if (!filled.length) return { ...base, type: "text", required: false };

  if (filled.every((c) => asBool(c) !== null) && !filled.every((c) => typeof c === "number")) return { ...base, type: "boolean" };
  if (filled.every((c) => asNumber(c) !== null)) {
    const nums = filled.map((c) => asNumber(c)!);
    return { ...base, type: nums.every((n) => Number.isInteger(n)) && filled.every((c) => typeof c === "number" || INT_RE.test(String(c).replace(/,/g, ""))) ? "integer" : "number" };
  }
  if (filled.every((c) => asDate(c) !== null)) return { ...base, type: "date" };
  if (texts.every((t) => URL_RE.test(t))) return { ...base, type: "url" };

  // Lists: most cells hold several short items split by the same separator.
  for (const sep of SEPARATORS) {
    const withSep = texts.filter((t) => t.includes(sep));
    if (withSep.length < Math.max(2, texts.length * 0.5)) continue;
    const items = texts.flatMap((t) => splitList(t, sep));
    const avg = items.reduce((n, s) => n + s.length, 0) / items.length;
    if (avg > 32 || texts.some((t) => t.length > 400) || items.some((s) => s.length > 60)) continue;
    const itemSet = new Set(items);
    const enumItems = itemSet.size <= 30 && itemSet.size < items.length / 2;
    return { ...base, type: "list", separator: sep, itemType: enumItems ? "enum" : "text", values: enumItems ? [...itemSet].sort() : undefined };
  }

  const longest = Math.max(...texts.map((t) => t.length));
  if (longest > 200 || texts.some((t) => t.includes("\n"))) return { ...base, type: "longtext" };

  // Choices: a small set of short values that repeat.
  if (filled.length >= 5 && distinct.size <= 20 && distinct.size <= filled.length / 2 && longest <= 40) {
    return { ...base, type: "enum", values: [...distinct].sort() };
  }
  return { ...base, type: "text" };
}

/** The first row (of the first ten) that looks like column titles. */
export function detectHeaderRow(rows: Cell[][]): number {
  const width = Math.max(0, ...rows.slice(0, 20).map((r) => r.filter((c) => clean(c) !== null).length));
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map(clean).filter((c) => c !== null);
    if (cells.length >= Math.max(1, Math.ceil(width * 0.5)) && cells.every((c) => typeof c === "string")) return i;
  }
  return 0;
}

export function dataRows(sheet: RawSheet, headerRow: number): Cell[][] {
  return sheet.rows.slice(headerRow + 1).filter((r) => r.some((c) => clean(c) !== null));
}

const NAME_HEADER = /^(name|title|label|full[\s_-]?name|display[\s_-]?name)$/i;
const ID_HEADER = /^(slug|id|key|handle|code)$/i;

/** Proposes how to read one sheet, starting from a given header row. */
export function planSheet(sheet: RawSheet, headerRow = detectHeaderRow(sheet.rows)): SheetPlan {
  const header = sheet.rows[headerRow] ?? [];
  const rows = dataRows(sheet, headerRow);
  const width = Math.max(header.length, ...rows.slice(0, 200).map((r) => r.length));
  const used = new Set<string>(["slug"]);
  const columns: ColumnPlan[] = [];
  for (let i = 0; i < width; i++) {
    const title = cellText(clean(header[i] ?? null));
    const cells = rows.map((r) => clean(r[i] ?? null));
    if (!title && cells.every((c) => c === null)) continue; // empty column
    const col = inferColumn(i, title, cells);
    let key = toKey(title) || `column_${i + 1}`;
    for (let n = 2; used.has(key); n++) key = `${(toKey(title) || `column_${i + 1}`).slice(0, 36)}_${n}`;
    used.add(key);
    columns.push({ ...col, key });
  }

  // Record ids: an id-like column with unique values, else a unique name-like column, else row numbers.
  const unique = (c: ColumnPlan) => c.stats.filled === rows.length && c.stats.distinct === rows.length && rows.length > 0;
  let id: IdSource = { kind: "row" };
  const idCol = columns.find((c) => ID_HEADER.test(c.header.trim()) && unique(c));
  // Names don't have to be unique: duplicates become name-2, name-3.
  const mostlyFilled = (c: ColumnPlan) => rows.length > 0 && c.stats.filled >= rows.length * 0.9;
  const nameCol =
    columns.find((c) => NAME_HEADER.test(c.header.trim()) && c.type === "text" && mostlyFilled(c)) ??
    columns.find((c) => c.type === "text" && mostlyFilled(c) && c.stats.distinct >= c.stats.filled * 0.8);
  if (idCol) {
    id = { kind: "column", index: idCol.index };
    if (/^(slug|id)$/i.test(idCol.header.trim())) idCol.include = false; // it *is* the slug
  } else if (nameCol) id = { kind: "name", index: nameCol.index };

  for (const c of columns.slice(LIMITS_FIELDS)) c.include = false;
  const name = sheet.name.trim() || "Sheet";
  return { name: sheet.name, include: true, slug: slugify(name) || "items", collectionName: name.slice(0, 60), headerRow, id, columns, rowCount: rows.length };
}


/** Record slugs for a sheet's rows, de-duplicated with -2, -3… */
export function rowSlugs(sheet: RawSheet, plan: SheetPlan): string[] {
  const rows = dataRows(sheet, plan.headerRow);
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const raw = plan.id.kind === "row" ? "" : cellText(clean(r[plan.id.index] ?? null));
    const base = slugify(raw) || `row-${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base.slice(0, 44)}-${n}`;
  });
}

/** Cell text → target record slug, by slug or by the target's name column. */
function lookupFor(sheet: RawSheet, plan: SheetPlan) {
  const slugs = rowSlugs(sheet, plan);
  const rows = dataRows(sheet, plan.headerRow);
  const map = new Map<string, string>();
  slugs.forEach((s, i) => {
    map.set(s, s);
    if (plan.id.kind !== "row") map.set(slugify(cellText(clean(rows[i][plan.id.index] ?? null))), s);
    const nameCol = plan.columns.find((c) => NAME_HEADER.test(c.header.trim())) ?? plan.columns.find((c) => c.type === "text");
    if (nameCol) map.set(slugify(cellText(clean(rows[i][nameCol.index] ?? null))), s);
  });
  return map;
}

/** Plans every sheet, then links columns whose values name rows of another sheet. */
export function planWorkbook(sheets: RawSheet[]): Plan {
  const plans = sheets.filter((s) => s.rows.some((r) => r.some((c) => clean(c) !== null))).map((s) => planSheet(s));
  // Unique collection paths.
  const taken = new Set<string>();
  for (const p of plans) {
    let slug = p.slug;
    for (let n = 2; taken.has(slug); n++) slug = `${p.slug}-${n}`;
    p.slug = slug;
    taken.add(slug);
  }
  plans.slice(8).forEach((p) => (p.include = false));
  const plan = { sheets: plans };
  linkSheets(plan, sheets);
  return plan;
}

/** Turns text columns whose values name another sheet's rows into references (in place). */
export function linkSheets(plan: Plan, sheets: RawSheet[]) {
  const plans = plan.sheets;
  const byName = new Map(sheets.map((s) => [s.name, s]));
  for (const p of plans) {
    for (const col of p.columns) {
      if (!col.include || (p.id.kind !== "row" && p.id.index === col.index)) continue;
      // Numbers only count as links when the header says so ("region_id", "Region").
      const numeric = col.type === "integer";
      if (col.type !== "text" && col.type !== "enum" && !numeric) continue;
      const values = new Set(dataRows(byName.get(p.name)!, p.headerRow).map((r) => slugify(cellText(clean(r[col.index] ?? null)))).filter(Boolean));
      if (!values.size) continue;
      for (const other of plans) {
        if (other === p || other.id.kind === "row") continue;
        if (numeric && !new RegExp(`(^|_)(${toKey(other.name)}|${toKey(other.name).replace(/s$/, "")})(_id)?$`).test(col.key)) continue;
        const lookup = lookupFor(byName.get(other.name)!, other);
        const hits = [...values].filter((v) => lookup.has(v)).length;
        if (hits / values.size >= 0.9) {
          col.type = "reference";
          col.targetSheet = other.name;
          col.values = undefined;
          break;
        }
      }
    }
  }
}

/** Changes a column's type, deriving choices or the list separator from its cells. */
export function retype(sheet: RawSheet, p: SheetPlan, col: ColumnPlan, type: FieldType, targetSheet?: string): ColumnPlan {
  const cells = dataRows(sheet, p.headerRow)
    .map((r) => clean(r[col.index] ?? null))
    .filter((c): c is Exclude<Cell, null> => c !== null);
  const next: ColumnPlan = { ...col, type, values: undefined, itemType: undefined, separator: undefined, targetSheet: undefined };
  if (type === "enum") next.values = [...new Set(cells.map(cellText))].slice(0, 200).map((v) => v.slice(0, 60)).sort();
  if (type === "list") {
    const texts = cells.map(cellText);
    const [best, hits] = SEPARATORS.map((sep) => [sep, texts.filter((t) => t.includes(sep)).length] as const).sort((a, b) => b[1] - a[1])[0];
    next.separator = hits ? best : ",";
    next.itemType = "text";
  }
  if (type === "reference") next.targetSheet = targetSheet;
  return next;
}

/* ------------------------------------------------------------------ build */

function convert(col: ColumnPlan, c: Cell, refs: Map<string, Map<string, string>>): { value: unknown } | { error: string } {
  if (c === null) return { value: col.type === "list" ? [] : null };
  switch (col.type) {
    case "integer":
    case "number": {
      const n = asNumber(c);
      if (n === null) return { error: `"${cellText(c)}" isn't a number` };
      if (col.type === "integer" && !Number.isInteger(n)) return { error: `${n} isn't a whole number` };
      return { value: n };
    }
    case "boolean": {
      const b = asBool(c) ?? (c === 1 ? true : c === 0 ? false : null);
      return b === null ? { error: `"${cellText(c)}" isn't yes/no` } : { value: b };
    }
    case "date": {
      const d = asDate(c);
      return d ? { value: d } : { error: `"${cellText(c)}" isn't a YYYY-MM-DD date` };
    }
    case "url": {
      const t = cellText(c);
      return URL_RE.test(t) ? { value: t } : { error: `"${t}" isn't a link` };
    }
    case "enum": {
      const t = cellText(c);
      return col.values?.includes(t) ? { value: t } : { error: `"${t}" isn't one of the choices` };
    }
    case "list": {
      const items = splitList(c, col.separator ?? ",");
      if (col.itemType === "enum") {
        const bad = items.find((i) => !col.values?.includes(i));
        if (bad) return { error: `"${bad}" isn't one of the choices` };
      }
      return { value: items };
    }
    case "reference": {
      const target = refs.get(col.targetSheet ?? "");
      const slug = target?.get(slugify(cellText(c)));
      return slug ? { value: slug } : { error: `no row in ${col.targetSheet} called "${cellText(c)}"` };
    }
    default:
      return { value: cellText(c) };
  }
}

export type BuildResult = {
  definition: DatasetDefinition | null;
  data: Record<string, RecordInput[]>;
  issues: Issue[];
  /** Cells left empty because they didn't fit, per sheet and column key. */
  invalid: Record<string, Record<string, number>>;
  problems: string[];
  records: number;
};

/** Collections in an order where referenced ones come first (for importing). */
export function importOrder(def: DatasetDefinition): string[] {
  const out: string[] = [];
  const visit = (slug: string, stack: Set<string>) => {
    if (out.includes(slug) || stack.has(slug)) return;
    stack.add(slug);
    const c = def.collections.find((x) => x.slug === slug);
    for (const f of c?.fields ?? []) if (f.type === "reference" && f.target && f.target !== slug) visit(f.target, stack);
    out.push(slug);
  };
  for (const c of def.collections) visit(c.slug, new Set());
  return out;
}

export function buildFromPlan(plan: Plan, sheets: RawSheet[]): BuildResult {
  const byName = new Map(sheets.map((s) => [s.name, s]));
  const included = plan.sheets.filter((p) => p.include);
  const slugOf = new Map(included.map((p) => [p.name, p.slug]));
  const refs = new Map(included.filter((p) => p.id.kind !== "row").map((p) => [p.name, lookupFor(byName.get(p.name)!, p)]));
  const issues: Issue[] = [];
  const invalid: BuildResult["invalid"] = {};
  const data: BuildResult["data"] = {};
  const problems: string[] = [];

  const collections = included.map((p) => {
    const cols = p.columns.filter((c) => c.include && !(c.type === "reference" && !slugOf.has(c.targetSheet ?? "")));
    const id = p.id;
    const nameCol = id.kind === "name" ? cols.find((c) => c.index === id.index) : (cols.find((c) => NAME_HEADER.test(c.header.trim())) ?? cols.find((c) => c.type === "text"));
    const fields: Field[] = cols.map((c) => {
      const f: Field = { key: c.key, label: c.label.slice(0, 60) || c.key, type: c.type, required: c.required, description: "" };
      if (c.type === "enum") f.values = c.values;
      if (c.type === "list") {
        f.itemType = c.itemType ?? "text";
        if (c.itemType === "enum") f.values = c.values;
      }
      if (c.type === "reference") {
        const target = included.find((x) => x.name === c.targetSheet)!;
        f.target = target.slug;
        const tName = target.columns.find((x) => x.include && x.type === "text" && (NAME_HEADER.test(x.header.trim()) || (target.id.kind === "name" && x.index === target.id.index)));
        f.embed = tName ? ["slug", tName.key] : undefined;
      }
      return f;
    });

    // Records
    const sheet = byName.get(p.name)!;
    const rows = dataRows(sheet, p.headerRow);
    const slugs = rowSlugs(sheet, p);
    const bad: Record<string, number> = {};
    data[p.slug] = rows.map((r, i) => {
      const values: Record<string, unknown> = {};
      for (const c of cols) {
        const res = convert(c, clean(r[c.index] ?? null), refs);
        if ("error" in res) {
          bad[c.key] = (bad[c.key] ?? 0) + 1;
          if (issues.length < 500) issues.push({ sheet: p.name, row: p.headerRow + i + 2, column: c.label, message: res.error });
          values[c.key] = c.type === "list" ? [] : null;
        } else values[c.key] = res.value;
      }
      return { slug: slugs[i], data: values };
    });
    invalid[p.name] = bad;
    // A column with gaps (or unreadable cells) can't be required.
    for (const f of fields) {
      if (f.required && (bad[f.key] || data[p.slug].some((r) => r.data[f.key] === null || (Array.isArray(r.data[f.key]) && !(r.data[f.key] as unknown[]).length)))) f.required = false;
    }

    const filters = cols
      .filter((c) => c.type === "enum" || c.type === "reference" || c.type === "boolean")
      .slice(0, 20)
      .map((c) => ({ param: c.key, path: c.key, op: "eq" as const, caseInsensitive: c.type === "enum", description: "" }));
    const searchFields = cols.filter((c) => c.type === "text" || (c.type === "list" && c.itemType !== "enum")).slice(0, 6).map((c) => c.key);
    return {
      slug: p.slug,
      name: p.collectionName || p.name,
      description: "",
      fields,
      sort: nameCol ? [{ field: nameCol.key, dir: "asc" as const }] : [],
      list: { enabled: true, paginate: true, defaultLimit: 20, maxLimit: 100 },
      detail: { enabled: true, include: [] as { collection: string; via: string; as: string; omitVia: boolean }[] },
      random: { enabled: true, maxCount: 10 },
      filters,
      search: { enabled: searchFields.length > 0, param: "q", fields: searchFields },
      counts: [] as { key: string; collection: string; via: string }[],
    };
  });

  // Search reaches through links too ("sao" finds sights in São Paulo), like menus' region.name.
  for (const c of collections) {
    for (const f of c.fields) {
      if (f.type !== "reference" || !f.embed?.[1] || c.search.fields.length >= 12) continue;
      c.search.fields.push(`${f.key}.${f.embed[1]}`);
      c.search.enabled = true;
    }
  }

  // Counts and related lists on the referenced collections.
  for (const c of collections) {
    for (const f of c.fields) {
      if (f.type !== "reference") continue;
      const target = collections.find((x) => x.slug === f.target);
      if (!target || target === c) continue;
      const keyBase = toKey(c.slug) || "items";
      const taken = new Set([...target.fields.map((x) => x.key), ...target.counts.map((x) => x.key)]);
      const countKey = `${keyBase}_count`.slice(0, 40);
      if (!taken.has(countKey) && target.counts.length < 6) target.counts.push({ key: countKey, collection: c.slug, via: f.key });
      if (target.detail.include.length < 4 && !target.detail.include.some((x) => x.as === keyBase) && !taken.has(keyBase)) {
        target.detail.include.push({ collection: c.slug, via: f.key, as: keyBase, omitVia: true });
      }
    }
  }

  const records = Object.values(data).reduce((n, r) => n + r.length, 0);
  if (!collections.length) problems.push("Include at least one sheet.");
  if (records > LIMITS.recordsPerApi) problems.push(`That's ${records.toLocaleString("en")} rows; an API holds up to ${LIMITS.recordsPerApi.toLocaleString("en")}.`);
  for (const c of collections) if (!c.fields.length) problems.push(`"${c.name}" has no columns included.`);

  let definition: DatasetDefinition | null = null;
  if (collections.length) {
    const parsed = datasetDefinitionSchema.safeParse({ kind: "dataset", collections, randomAlias: null });
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      problems.push(`${i.path.join(".")}: ${i.message}`);
    } else {
      definition = parsed.data;
      problems.push(...checkDataset(definition));
    }
  }
  return { definition: problems.length ? null : definition, data, issues, invalid, problems, records };
}

/* ------------------------------------------------- import into a collection */

/**
 * Maps a sheet onto the collection: columns match fields by key or label
 * ("Spice level" → spice_level), references accept names as well as slugs,
 * and without a slug column, slugs come from the first text field.
 */
export function mapSheet(c: Collection, sheet: RawSheet, fileName: string) {
  const headerRow = detectHeaderRow(sheet.rows);
  const headers = (sheet.rows[headerRow] ?? []).map((h) => cellText(clean(h ?? null)));
  const norm = headers.map((h) => toKey(h));
  const find = (key: string, label?: string) => norm.findIndex((h, i) => h === key || (label !== undefined && h === toKey(label)) || headers[i] === key);
  const slugAt = find("slug");
  const at = new Map(c.fields.map((f) => [f.key, find(f.key, f.label)]));
  const titleField = c.fields.find((f) => f.type === "text" && (at.get(f.key) ?? -1) >= 0);
  const mapped = new Set([slugAt, ...at.values()].filter((i) => i >= 0));
  const missing = [...(slugAt < 0 && !titleField ? ["slug"] : []), ...c.fields.filter((f) => f.required && (at.get(f.key) ?? -1) < 0).map((f) => f.key)];

  const rows = dataRows(sheet, headerRow).map((r, n) => {
    const data: Record<string, unknown> = {};
    for (const f of c.fields) {
      const i = at.get(f.key) ?? -1;
      if (i < 0) continue;
      const text = cellText(clean(r[i] ?? null));
      data[f.key] = f.type === "reference" && text ? slugify(text) : fromCell(f, text);
    }
    const slug = slugAt >= 0 ? cellText(clean(r[slugAt] ?? null)) : titleField ? slugify(cellText(clean(r[at.get(titleField.key)!] ?? null))) || `row-${n + 1}` : "";
    return { slug, data };
  });
  return {
    rows,
    columns: headers.filter(Boolean),
    unknown: headers.filter((h, i) => h && !mapped.has(i)),
    missing,
    fileName,
    note: slugAt < 0 && titleField ? `No slug column: slugs are made from “${titleField.label}”. Matching slugs update existing records.` : undefined,
  };
}
