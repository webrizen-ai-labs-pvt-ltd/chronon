import { redirect } from "next/navigation";
import { listRecords, recordCounts, referenceOptions } from "@/lib/builder/repo";
import { workspace, type WorkspaceParams } from "../load";
import { DataGrid } from "./data-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data" };

export default async function DataPage({ params, searchParams }: { params: WorkspaceParams; searchParams: Promise<{ collection?: string; q?: string; page?: string }> }) {
  const { api, version, def, n, base } = await workspace(params);
  if (def.kind !== "dataset") redirect(`${base}/configure`);
  const sp = await searchParams;
  const collection = def.collections.find((c) => c.slug === sp.collection) ?? def.collections[0];
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);

  const targets = [...new Set(collection.fields.filter((f) => f.type === "reference" && f.target).map((f) => f.target!))];
  const [list, counts, ...refLists] = await Promise.all([
    listRecords(version.id, collection.slug, { q, page, pageSize: 50 }),
    recordCounts(version.id),
    ...targets.map((t) => referenceOptions(version.id, t)),
  ]);

  return (
    <DataGrid
      key={collection.slug}
      slug={api.slug}
      version={n}
      collections={def.collections.map((c) => ({ slug: c.slug, name: c.name, count: counts.get(c.slug) ?? 0 }))}
      collection={collection}
      rows={list.rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))}
      total={list.total}
      page={list.page}
      pageSize={list.pageSize}
      q={q}
      refs={Object.fromEntries(targets.map((t, i) => [t, refLists[i]]))}
      readOnly={version.state === "retired"}
      exportBase={`${base}/export`}
    />
  );
}
