import { LIMITS, SLUG_RE, type Collection, type Field } from "./definition";

/**
 * Validation for builder records. The same rules run for the record form, CSV
 * import and schema changes, so data in the database always matches the
 * collection's fields.
 */

export type RecordInput = { slug: unknown; data: Record<string, unknown> };
export type RecordErrors = Record<string, string>; // field key (or "slug") → message
export type ValidRecord = { slug: string; data: Record<string, unknown> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isBlank(v: unknown) {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
}

/** Checks one value against its field. Returns the cleaned value, or an error message. */
export function checkValue(f: Field, v: unknown): { value: unknown } | { error: string } {
  if (isBlank(v)) return f.required ? { error: "Required." } : { value: f.type === "list" ? [] : null };
  switch (f.type) {
    case "text":
    case "longtext": {
      if (typeof v !== "string") return { error: "Must be text." };
      const s = f.type === "text" ? v.trim() : v.replace(/\r\n/g, "\n").trim();
      if (f.maxLength && s.length > f.maxLength) return { error: `At most ${f.maxLength} characters.` };
      if (f.pattern && !new RegExp(f.pattern).test(s)) return { error: `Doesn't match ${f.pattern}.` };
      return { value: s };
    }
    case "integer":
    case "number": {
      if (typeof v !== "number" || !Number.isFinite(v)) return { error: "Must be a number." };
      if (f.type === "integer" && !Number.isInteger(v)) return { error: "Must be a whole number." };
      if (f.min !== undefined && v < f.min) return { error: `At least ${f.min}.` };
      if (f.max !== undefined && v > f.max) return { error: `At most ${f.max}.` };
      return { value: v };
    }
    case "boolean":
      return typeof v === "boolean" ? { value: v } : { error: "Must be true or false." };
    case "enum":
      return typeof v === "string" && f.values?.includes(v) ? { value: v } : { error: `One of: ${(f.values ?? []).join(", ")}.` };
    case "list": {
      if (!Array.isArray(v)) return { error: "Must be a list." };
      const out: string[] = [];
      for (const item of v) {
        if (typeof item !== "string" || !item.trim()) return { error: "List items must be non-empty text." };
        const s = item.trim();
        if (f.itemType === "enum" && !f.values?.includes(s)) return { error: `"${s}" isn't one of: ${(f.values ?? []).join(", ")}.` };
        if (f.maxLength && s.length > f.maxLength) return { error: `Items are at most ${f.maxLength} characters.` };
        out.push(s);
      }
      if (out.length > 200) return { error: "At most 200 items." };
      return { value: out };
    }
    case "date": {
      if (typeof v !== "string" || !DATE_RE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) return { error: "Use YYYY-MM-DD." };
      return { value: v };
    }
    case "url": {
      if (typeof v !== "string") return { error: "Must be a URL." };
      try {
        const u = new URL(v.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") return { error: "Use an http(s) URL." };
        return { value: u.toString() };
      } catch {
        return { error: "Must be a URL." };
      }
    }
    case "reference":
      return typeof v === "string" && SLUG_RE.test(v.trim()) ? { value: v.trim() } : { error: "Must be a record slug." };
  }
}

/**
 * Validates a whole record. `refExists` checks reference targets; pass it when
 * the target records are available (form saves, imports).
 */
export function validateRecord(
  c: Collection,
  input: RecordInput,
  refExists?: (collection: string, slug: string) => boolean,
): { ok: true; record: ValidRecord } | { ok: false; errors: RecordErrors } {
  const errors: RecordErrors = {};
  const slug = typeof input.slug === "string" ? input.slug.trim() : "";
  if (!SLUG_RE.test(slug) || slug.length > 48) errors.slug = "Use lowercase-kebab-case, up to 48 characters.";
  else if (slug === "random") errors.slug = '"random" is reserved.';

  const data: Record<string, unknown> = {};
  for (const f of c.fields) {
    const res = checkValue(f, input.data[f.key]);
    if ("error" in res) {
      errors[f.key] = res.error;
      continue;
    }
    if (f.type === "reference" && typeof res.value === "string" && f.target && refExists && !refExists(f.target, res.value)) {
      errors[f.key] = `No ${f.target} record "${res.value}".`;
      continue;
    }
    data[f.key] = res.value;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  if (JSON.stringify(data).length > LIMITS.recordBytes) return { ok: false, errors: { slug: `Record is larger than ${LIMITS.recordBytes / 1024} KB.` } };
  return { ok: true, record: { slug, data } };
}

/* ------------------------------------------------------------------- CSV */

/** Separator for list values in CSV cells. */
export const LIST_SEPARATOR = "|";

/** Turns a CSV cell into the value its field expects (validation happens after). */
export function fromCell(f: Field, raw: string | undefined): unknown {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  switch (f.type) {
    case "integer":
    case "number": {
      const n = Number(s);
      return Number.isFinite(n) ? n : s;
    }
    case "boolean": {
      const l = s.toLowerCase();
      if (["true", "yes", "1", "y"].includes(l)) return true;
      if (["false", "no", "0", "n"].includes(l)) return false;
      return s;
    }
    case "list":
      if (s.startsWith("[")) {
        try {
          const parsed: unknown = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          /* fall through to the separator */
        }
      }
      // "a | b" (our exports), or the "a; b" / "a, b" people type in spreadsheets.
      return s
        .split(s.includes(LIST_SEPARATOR) ? LIST_SEPARATOR : s.includes(";") ? ";" : ",")
        .map((x) => x.trim())
        .filter(Boolean);
    default:
      return s;
  }
}

/** The CSV cell for a stored value. */
export function toCell(f: Field, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (f.type === "list" && Array.isArray(v)) return v.join(` ${LIST_SEPARATOR} `);
  return String(v);
}

/** Column order for CSV import/export: slug first, then fields. */
export function csvColumns(c: Collection) {
  return ["slug", ...c.fields.map((f) => f.key)];
}
