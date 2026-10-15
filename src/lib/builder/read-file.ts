import Papa from "papaparse";
import type { Cell, RawSheet } from "./infer";

/**
 * Reads an uploaded spreadsheet in the browser: .xlsx (every sheet), .csv /
 * .tsv, or .json (an array of objects, { data: [...] }, or { sheetName: [...] }).
 * Formulas are never evaluated; Excel's saved values are used.
 */

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const ACCEPT = ".xlsx,.csv,.tsv,.txt,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/json";

export class FileReadError extends Error {}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "").trim() || "Sheet";
}

function toCell(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v instanceof Date) return v;
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? objectLabel(x) : String(x))).join(" | ");
  if (typeof v === "object") return objectLabel(v);
  return String(v);
}

/** {slug, name} objects (e.g. an embedded reference) → their slug or name. */
function objectLabel(o: object): string {
  const r = o as Record<string, unknown>;
  for (const k of ["slug", "id", "name", "title"]) if (typeof r[k] === "string" || typeof r[k] === "number") return String(r[k]);
  return JSON.stringify(o);
}

function objectsToSheet(name: string, items: unknown[]): RawSheet {
  const objects = items.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x));
  const keys = [...new Set(objects.flatMap((o) => Object.keys(o)))];
  return { name, rows: [keys, ...objects.map((o) => keys.map((k) => toCell(o[k])))] };
}

export async function readWorkbook(file: File): Promise<RawSheet[]> {
  if (file.size > MAX_FILE_BYTES) throw new FileReadError("That file is larger than 15 MB. Split it into smaller files.");
  const ext = file.name.toLowerCase().split(".").pop() ?? "";

  if (ext === "xls") throw new FileReadError("Old .xls files aren't supported. In Excel, use File → Save As → Excel Workbook (.xlsx).");
  if (ext === "xlsx") {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    try {
      const sheets = await readXlsxFile(file);
      return sheets.map((s) => ({ name: s.sheet, rows: s.data.map((r) => r.map((c) => (c === null ? null : (c as Cell)))) }));
    } catch {
      throw new FileReadError("Couldn't read that workbook. Make sure it's a valid .xlsx file (not password-protected).");
    }
  }
  if (ext === "json") {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new FileReadError("That file isn't valid JSON.");
    }
    if (Array.isArray(data)) return [objectsToSheet(baseName(file.name), data)];
    if (data && typeof data === "object") {
      const entries = Object.entries(data as Record<string, unknown>).filter(([, v]) => Array.isArray(v));
      if (entries.length) return entries.map(([k, v]) => objectsToSheet(k, v as unknown[]));
    }
    throw new FileReadError("Expected a JSON array of objects, or an object whose values are arrays (one per sheet).");
  }
  if (["csv", "tsv", "txt"].includes(ext)) {
    const text = (await file.text()).replace(/^﻿/, "");
    const res = Papa.parse<string[]>(text, { delimiter: ext === "tsv" ? "\t" : "", skipEmptyLines: "greedy" });
    if (!res.data.length) throw new FileReadError("That file has no rows.");
    return [{ name: baseName(file.name), rows: res.data.map((r) => r.map((c) => (c === "" ? null : c))) }];
  }
  throw new FileReadError("Upload an Excel (.xlsx), CSV or JSON file.");
}

/** A friendly API name from a file name: "regional_menus-2026.xlsx" → "Regional menus 2026". */
export function nameFromFile(name: string) {
  const s = baseName(name).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
