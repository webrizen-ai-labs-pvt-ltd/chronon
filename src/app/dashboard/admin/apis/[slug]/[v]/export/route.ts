import Papa from "papaparse";
import { adminActor } from "@/lib/admin";
import { csvColumns, toCell } from "@/lib/builder/records";
import { allRecords, getVersion, parseDefinition } from "@/lib/builder/repo";

/** GET …/export?collection=dishes&format=csv|json — downloads a collection for backup or bulk editing. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string; v: string }> }) {
  try {
    await adminActor();
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const { slug, v } = await ctx.params;
  const n = /^v(\d{1,3})$/.exec(v);
  const found = n ? await getVersion(slug, Number(n[1])) : null;
  if (!found) return new Response("Not found", { status: 404 });
  const def = parseDefinition(found.version);
  const url = new URL(req.url);
  const c = def.kind === "dataset" ? def.collections.find((x) => x.slug === url.searchParams.get("collection")) : undefined;
  if (!c) return new Response("Unknown collection", { status: 404 });

  const rows = (await allRecords(found.version.id))[c.slug] ?? [];
  const name = `${slug}-v${n![1]}-${c.slug}`;
  if (url.searchParams.get("format") === "json") {
    const body = JSON.stringify(rows.map((r) => ({ slug: r.slug, ...Object.fromEntries(c.fields.map((f) => [f.key, r.data[f.key] ?? null])) })), null, 2);
    return new Response(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}.json"`, "Cache-Control": "no-store" } });
  }
  const csv = Papa.unparse({
    fields: csvColumns(c),
    data: rows.map((r) => [r.slug, ...c.fields.map((f) => toCell(f, r.data[f.key]))]),
  });
  return new Response(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" } });
}
