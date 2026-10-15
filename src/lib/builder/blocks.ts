import { createHash, randomBytes, randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { normalize } from "./engine";

/**
 * Pre-built utility APIs. An admin picks a block, names the API and tunes its
 * settings; the block does the work. Blocks only compute from their inputs:
 * none of them fetch URLs or touch the database.
 */

export type BlockSetting =
  | { key: string; label: string; help: string; type: "integer"; default: number; min: number; max: number }
  | { key: string; label: string; help: string; type: "text"; default: string; maxLength: number }
  | { key: string; label: string; help: string; type: "multi"; default: string[]; options: string[] };

export type BlockParam = { name: string; type: string; required: boolean; description: string; example?: string };

export type BlockOutput =
  | { status: number; body: unknown }
  | { status: number; raw: string; contentType: string }
  | { status: number; error: { code: "invalid_request" | "not_found"; message: string } };

type Settings = Record<string, unknown>;

export type Block = {
  id: string;
  name: string;
  summary: string;
  settings: BlockSetting[];
  params: (s: Settings) => BlockParam[];
  example: Record<string, string>;
  run: (query: URLSearchParams, s: Settings) => BlockOutput | Promise<BlockOutput>;
};

const invalid = (message: string): BlockOutput => ({ status: 400, error: { code: "invalid_request", message } });

/** Parses the query with `schema`, turning the first issue into a 400 message. */
function parse<S extends z.ZodType>(schema: S, query: URLSearchParams): { ok: true; data: z.output<S> } | { ok: false; out: BlockOutput } {
  const r = schema.safeParse(Object.fromEntries(query));
  if (r.success) return { ok: true, data: r.data };
  const issue = r.error.issues[0];
  return { ok: false, out: invalid(`Invalid \`${issue?.path.join(".") || "query"}\`: ${issue?.message ?? "bad value"}.`) };
}

const num = (s: Settings, k: string, d: number) => (typeof s[k] === "number" ? (s[k] as number) : d);
const str = (s: Settings, k: string, d: string) => (typeof s[k] === "string" ? (s[k] as string) : d);
const list = (s: Settings, k: string, d: string[]) => (Array.isArray(s[k]) && (s[k] as unknown[]).length ? (s[k] as string[]) : d);

/* --------------------------------------------------------------------- QR */

const qr: Block = {
  id: "qr",
  name: "QR code",
  summary: "Encode text or a link as a QR code, returned as SVG.",
  settings: [
    { key: "maxLength", label: "Max input length", help: "Longest text accepted, in characters.", type: "integer", default: 1000, min: 16, max: 2000 },
    { key: "defaultSize", label: "Default size", help: "Width and height in pixels when `size` isn't sent.", type: "integer", default: 256, min: 64, max: 1024 },
  ],
  params: (s) => [
    { name: "text", type: "string", required: true, description: `Text or URL to encode, up to ${num(s, "maxLength", 1000)} characters.`, example: "https://chronon.webrizen.com" },
    { name: "size", type: "integer", required: false, description: `Pixels, 64–1024. Default ${num(s, "defaultSize", 256)}.` },
    { name: "margin", type: "integer", required: false, description: "Quiet zone in modules, 0–8. Default 2." },
    { name: "ecc", type: "L | M | Q | H", required: false, description: "Error correction level. Default M." },
    { name: "dark / light", type: "hex colour", required: false, description: "Module and background colours, e.g. 0b0b12. Default black on white." },
    { name: "format", type: "svg | json", required: false, description: "`svg` returns the image; `json` wraps it as { data: { svg } }. Default svg." },
  ],
  example: { text: "https://chronon.webrizen.com", size: "256" },
  async run(query, s) {
    const hex = z.string().regex(/^#?[0-9a-fA-F]{6}$/, "use a 6-digit hex colour").transform((v) => `#${v.replace("#", "")}`);
    const p = parse(
      z.object({
        text: z.string().min(1).max(num(s, "maxLength", 1000)),
        size: z.coerce.number().int().min(64).max(1024).default(num(s, "defaultSize", 256)),
        margin: z.coerce.number().int().min(0).max(8).default(2),
        ecc: z.enum(["L", "M", "Q", "H"]).default("M"),
        dark: hex.default("#000000"),
        light: hex.default("#ffffff"),
        format: z.enum(["svg", "json"]).default("svg"),
      }),
      query,
    );
    if (!p.ok) return p.out;
    const { text, size, margin, ecc, dark, light, format } = p.data;
    let svg: string;
    try {
      svg = await QRCode.toString(text, { type: "svg", width: size, margin, errorCorrectionLevel: ecc, color: { dark, light } });
    } catch {
      return invalid("That text is too long to fit in a QR code at this error-correction level.");
    }
    return format === "json" ? { status: 200, body: { data: { svg, size } } } : { status: 200, raw: svg, contentType: "image/svg+xml; charset=utf-8" };
  },
};

/* ---------------------------------------------------------------- slugify */

export function slugify(text: string, separator = "-", maxLength = 80) {
  const s = normalize(text)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");
  return s.slice(0, maxLength).replace(new RegExp(`\\${separator}+$`), "");
}

const slugBlock: Block = {
  id: "slugify",
  name: "Slugify",
  summary: "Turn any title into a clean, URL-safe slug.",
  settings: [{ key: "maxLength", label: "Max slug length", help: "Slugs are cut at a separator below this length.", type: "integer", default: 80, min: 8, max: 200 }],
  params: () => [
    { name: "text", type: "string", required: true, description: "Up to 500 characters.", example: "Crème Brûlée & Café" },
    { name: "separator", type: "- | _ | .", required: false, description: "Default `-`." },
  ],
  example: { text: "Crème Brûlée & Café" },
  run(query, s) {
    const p = parse(z.object({ text: z.string().min(1).max(500), separator: z.enum(["-", "_", "."]).default("-") }), query);
    if (!p.ok) return p.out;
    return { status: 200, body: { data: { slug: slugify(p.data.text, p.data.separator, num(s, "maxLength", 80)) } } };
  },
};

/* ------------------------------------------------------------- text stats */

export function textStats(text: string, wpm = 238) {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  const sentences = text.split(/[.!?…]+(?:\s|$)/u).filter((x) => /[\p{L}\p{N}]/u.test(x)).length;
  const paragraphs = text.split(/\n\s*\n/).filter((x) => x.trim()).length;
  const letters = words.reduce((n, w) => n + w.length, 0);
  return {
    characters: [...text].length,
    characters_no_spaces: [...text.replace(/\s/g, "")].length,
    words: words.length,
    sentences,
    paragraphs,
    average_word_length: words.length ? Math.round((letters / words.length) * 10) / 10 : 0,
    reading_time_seconds: Math.ceil((words.length / wpm) * 60),
  };
}

const textBlock: Block = {
  id: "text-stats",
  name: "Text statistics",
  summary: "Count characters, words, sentences and estimate reading time.",
  settings: [
    { key: "maxLength", label: "Max input length", help: "Longest text accepted, in characters.", type: "integer", default: 5000, min: 100, max: 6000 },
    { key: "wpm", label: "Reading speed", help: "Words per minute used for reading time.", type: "integer", default: 238, min: 100, max: 600 },
  ],
  params: (s) => [{ name: "text", type: "string", required: true, description: `Up to ${num(s, "maxLength", 5000)} characters.`, example: "Chronon is free. Use it well." }],
  example: { text: "Chronon is free. Use it well." },
  run(query, s) {
    const p = parse(z.object({ text: z.string().min(1).max(num(s, "maxLength", 5000)) }), query);
    if (!p.ok) return p.out;
    return { status: 200, body: { data: textStats(p.data.text, num(s, "wpm", 238)) } };
  },
};

/* ------------------------------------------------------------------ units */

type Category = { base: string; units: Record<string, number> };
export const UNIT_CATEGORIES: Record<string, Category> = {
  length: { base: "m", units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852 } },
  mass: { base: "kg", units: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.028349523125, lb: 0.45359237, st: 6.35029318 } },
  volume: {
    base: "l",
    units: { ml: 0.001, l: 1, m3: 1000, tsp: 0.00492892159375, tbsp: 0.01478676478125, floz: 0.0295735295625, cup: 0.2365882365, pt: 0.473176473, qt: 0.946352946, gal: 3.785411784 },
  },
  temperature: { base: "c", units: { c: 1, f: 1, k: 1 } },
  speed: { base: "mps", units: { mps: 1, kph: 1 / 3.6, mph: 0.44704, kn: 1852 / 3600, fps: 0.3048 } },
  area: { base: "m2", units: { mm2: 1e-6, cm2: 1e-4, m2: 1, km2: 1e6, ha: 1e4, acre: 4046.8564224, in2: 0.00064516, ft2: 0.09290304, mi2: 2589988.110336 } },
  data: { base: "byte", units: { bit: 0.125, byte: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 } },
  time: { base: "s", units: { ms: 0.001, s: 1, min: 60, h: 3600, d: 86400, wk: 604800 } },
};

function toCelsius(v: number, u: string) {
  return u === "f" ? ((v - 32) * 5) / 9 : u === "k" ? v - 273.15 : v;
}
function fromCelsius(v: number, u: string) {
  return u === "f" ? (v * 9) / 5 + 32 : u === "k" ? v + 273.15 : v;
}

export function convertUnits(value: number, from: string, to: string, categories = Object.keys(UNIT_CATEGORIES)) {
  const cat = categories.find((c) => from in (UNIT_CATEGORIES[c]?.units ?? {}));
  if (!cat) return null;
  const units = UNIT_CATEGORIES[cat].units;
  if (!(to in units)) return { category: cat, error: `Can't convert ${cat} to "${to}". Use one of: ${Object.keys(units).join(", ")}.` };
  const result = cat === "temperature" ? fromCelsius(toCelsius(value, from), to) : (value * units[from]) / units[to];
  return { category: cat, result: Number(result.toPrecision(12)) };
}

const unitsBlock: Block = {
  id: "units",
  name: "Unit converter",
  summary: "Convert length, mass, volume, temperature, speed, area, data and time.",
  settings: [
    { key: "categories", label: "Categories", help: "Which kinds of units this API converts.", type: "multi", default: Object.keys(UNIT_CATEGORIES), options: Object.keys(UNIT_CATEGORIES) },
  ],
  params: (s) => [
    { name: "value", type: "number", required: true, description: "The amount to convert.", example: "12" },
    { name: "from", type: "unit", required: true, description: `Source unit. ${list(s, "categories", Object.keys(UNIT_CATEGORIES)).map((c) => `${c}: ${Object.keys(UNIT_CATEGORIES[c]?.units ?? {}).join(", ")}`).join("; ")}.`, example: "km" },
    { name: "to", type: "unit", required: true, description: "Target unit, in the same category.", example: "mi" },
  ],
  example: { value: "12", from: "km", to: "mi" },
  run(query, s) {
    const p = parse(z.object({ value: z.coerce.number().finite(), from: z.string().min(1).max(8).toLowerCase(), to: z.string().min(1).max(8).toLowerCase() }), query);
    if (!p.ok) return p.out;
    const { value, from, to } = p.data;
    const res = convertUnits(value, from, to, list(s, "categories", Object.keys(UNIT_CATEGORIES)));
    if (!res) return invalid(`Unknown unit "${from}".`);
    if ("error" in res) return invalid(res.error!);
    return { status: 200, body: { data: { value, from, to, category: res.category, result: res.result } } };
  },
};

/* ------------------------------------------------------------- time zones */

const zoneSchema = z.string().refine((zn) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zn });
    return true;
  } catch {
    return false;
  }
}, "unknown IANA time zone");

/** Offset of `zone` from UTC at `date`, in minutes. */
export function zoneOffset(zone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");
function formatOffset(min: number) {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function inZone(date: Date, zone: string) {
  const off = zoneOffset(zone, date);
  const local = new Date(date.getTime() + off * 60000).toISOString().slice(0, 19);
  const abbr = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  return { zone, local, offset: formatOffset(off), abbreviation: abbr, iso: `${local}${formatOffset(off)}` };
}

/** Parses an ISO time; a time without an offset is read in `from`. */
export function parseTime(raw: string | undefined, from: string): Date | null {
  if (!raw) return new Date();
  if (/^\d{9,11}$/.test(raw)) return new Date(Number(raw) * 1000);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
    // Two passes settle the offset across DST changes.
    let t = naive - zoneOffset(from, new Date(naive)) * 60000;
    t = naive - zoneOffset(from, new Date(t)) * 60000;
    return new Date(t);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const tzBlock: Block = {
  id: "timezones",
  name: "Time zone converter",
  summary: "Convert a moment between IANA time zones, DST-aware.",
  settings: [{ key: "maxZones", label: "Max target zones", help: "How many zones one request may ask for.", type: "integer", default: 10, min: 1, max: 25 }],
  params: (s) => [
    { name: "time", type: "ISO 8601 | unix seconds", required: false, description: "Defaults to now. Without an offset it's read in `from`.", example: "2026-10-15T09:30" },
    { name: "from", type: "IANA zone", required: false, description: "Zone for times without an offset. Default UTC.", example: "Asia/Kolkata" },
    { name: "to", type: "IANA zones", required: true, description: `Comma-separated, up to ${num(s, "maxZones", 10)}.`, example: "Europe/London,America/New_York" },
  ],
  example: { time: "2026-10-15T09:30", from: "Asia/Kolkata", to: "Europe/London,America/New_York" },
  run(query, s) {
    const max = num(s, "maxZones", 10);
    const p = parse(
      z.object({
        time: z.string().max(40).optional(),
        from: zoneSchema.default("UTC"),
        to: z
          .string()
          .min(1)
          .transform((v) => v.split(",").map((x) => x.trim()).filter(Boolean))
          .pipe(z.array(zoneSchema).min(1).max(max, `at most ${max} zones`)),
      }),
      query,
    );
    if (!p.ok) return p.out;
    const date = parseTime(p.data.time, p.data.from);
    if (!date) return invalid("Invalid `time`: use ISO 8601 (2026-10-15T09:30, optionally with Z or +05:30) or unix seconds.");
    return { status: 200, body: { data: { utc: date.toISOString(), unix: Math.floor(date.getTime() / 1000), from: inZone(date, p.data.from), to: p.data.to.map((zn) => inZone(date, zn)) } } };
  },
};

/* -------------------------------------------------------------------- ids */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function ulid(now = Date.now()) {
  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = randomBytes(16);
  let rand = "";
  for (let i = 0; i < 16; i++) rand += CROCKFORD[bytes[i] % 32];
  return time + rand;
}

export function uuid7(now = Date.now()) {
  const b = randomBytes(16);
  const ms = BigInt(now);
  for (let i = 0; i < 6; i++) b[i] = Number((ms >> BigInt(8 * (5 - i))) & BigInt(0xff));
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const idsBlock: Block = {
  id: "ids",
  name: "Unique IDs",
  summary: "Generate UUID v4, UUID v7 or ULID identifiers.",
  settings: [{ key: "maxCount", label: "Max per request", help: "Most IDs one request may generate.", type: "integer", default: 25, min: 1, max: 100 }],
  params: (s) => [
    { name: "type", type: "uuid | uuid7 | ulid", required: false, description: "Default uuid (v4).", example: "uuid7" },
    { name: "count", type: "integer", required: false, description: `1–${num(s, "maxCount", 25)}. Default 1.`, example: "3" },
  ],
  example: { type: "uuid7", count: "3" },
  run(query, s) {
    const p = parse(z.object({ type: z.enum(["uuid", "uuid7", "ulid"]).default("uuid"), count: z.coerce.number().int().min(1).max(num(s, "maxCount", 25)).default(1) }), query);
    if (!p.ok) return p.out;
    const make = p.data.type === "ulid" ? () => ulid() : p.data.type === "uuid7" ? () => uuid7() : () => randomUUID();
    return { status: 200, body: { data: Array.from({ length: p.data.count }, make), type: p.data.type } };
  },
};

/* ------------------------------------------------------------------- hash */

const HASHES = ["md5", "sha1", "sha256", "sha384", "sha512"];
const hashBlock: Block = {
  id: "hash",
  name: "Hash",
  summary: "Hash text with SHA-2, SHA-1 or MD5, as hex or base64.",
  settings: [
    { key: "algorithms", label: "Algorithms", help: "Which algorithms callers may pick.", type: "multi", default: HASHES, options: HASHES },
    { key: "maxLength", label: "Max input length", help: "Longest text accepted, in characters.", type: "integer", default: 5000, min: 16, max: 6000 },
    { key: "defaultAlgorithm", label: "Default algorithm", help: "Used when `algorithm` isn't sent.", type: "text", default: "sha256", maxLength: 8 },
  ],
  params: (s) => [
    { name: "text", type: "string", required: true, description: `Up to ${num(s, "maxLength", 5000)} characters, hashed as UTF-8.`, example: "hello" },
    { name: "algorithm", type: list(s, "algorithms", HASHES).join(" | "), required: false, description: `Default ${str(s, "defaultAlgorithm", "sha256")}.` },
    { name: "encoding", type: "hex | base64", required: false, description: "Default hex." },
  ],
  example: { text: "hello", algorithm: "sha256" },
  run(query, s) {
    const algos = list(s, "algorithms", HASHES);
    const fallback = algos.includes(str(s, "defaultAlgorithm", "sha256")) ? str(s, "defaultAlgorithm", "sha256") : algos[0];
    const p = parse(
      z.object({
        text: z.string().min(1).max(num(s, "maxLength", 5000)),
        algorithm: z.enum(algos as [string, ...string[]]).default(fallback),
        encoding: z.enum(["hex", "base64"]).default("hex"),
      }),
      query,
    );
    if (!p.ok) return p.out;
    const digest = createHash(p.data.algorithm).update(p.data.text, "utf8").digest(p.data.encoding);
    return { status: 200, body: { data: { algorithm: p.data.algorithm, encoding: p.data.encoding, digest } } };
  },
};

/* --------------------------------------------------------------- registry */

export const BLOCKS: Block[] = [qr, slugBlock, textBlock, unitsBlock, tzBlock, idsBlock, hashBlock];
export const blockById = new Map(BLOCKS.map((b) => [b.id, b]));

/** Validates an admin's settings for a block, filling defaults. */
export function blockSettingsSchema(block: Block) {
  const shape: Record<string, z.ZodType> = {};
  for (const st of block.settings) {
    if (st.type === "integer") shape[st.key] = z.number().int().min(st.min).max(st.max).default(st.default);
    else if (st.type === "text") shape[st.key] = z.string().max(st.maxLength).default(st.default);
    else shape[st.key] = z.array(z.enum(st.options as [string, ...string[]])).min(1).default(st.default);
  }
  return z.object(shape);
}

export function defaultSettings(block: Block): Settings {
  return Object.fromEntries(block.settings.map((s) => [s.key, s.default]));
}
