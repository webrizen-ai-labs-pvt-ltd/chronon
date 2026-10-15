import Link from "next/link";
import { Alert, Card, KeyValue, Sparkbars, Tag } from "@/components/admin/kit";
import { CopyButton } from "@/components/copy-button";
import { blockById } from "@/lib/builder/blocks";
import { describeEndpoints } from "@/lib/builder/describe";
import { LIMITS } from "@/lib/builder/definition";
import { invalidRecords, recordCounts } from "@/lib/builder/repo";
import { apiUsage } from "@/lib/builder/serve";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { site } from "@/lib/site";
import { workspace, type WorkspaceParams } from "./load";

export const dynamic = "force-dynamic";

export default async function WorkspaceOverview({ params }: { params: WorkspaceParams }) {
  const { api, version, def, n, base } = await workspace(params);
  const endpoints = describeEndpoints(def, api.slug, n);
  const [counts, usage, invalid] = await Promise.all([
    recordCounts(version.id),
    apiUsage([api.slug], 14),
    def.kind === "dataset" && version.state === "draft" ? invalidRecords(version.id, def) : Promise.resolve([]),
  ]);
  const days = usage.get(api.slug) ?? [];
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-6">
      {version.state === "draft" && (
        <Alert tone="info" title="Private draft">
          Nothing here is served yet. Shape the {def.kind === "dataset" ? "schema and data" : "settings"}, try it in the{" "}
          <Link href={`${base}/playground`} className="font-semibold text-inherit underline">
            playground
          </Link>
          , then publish.
        </Alert>
      )}
      {invalid.length > 0 && (
        <Alert tone="warning" title={`${invalid.length} record${invalid.length === 1 ? "" : "s"} don't match the schema`}>
          Fix them in{" "}
          <Link href={`${base}/data?collection=${invalid[0].collection}`} className="font-semibold text-inherit underline">
            Data
          </Link>{" "}
          before publishing. First: <code className="font-mono">{invalid[0].collection}/{invalid[0].slug}</code> ({Object.entries(invalid[0].errors)[0]?.join(": ")}).
        </Alert>
      )}
      {version.state === "retired" && <Alert tone="warning">This version is retired: requests get 410 Gone and it&apos;s read-only.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Endpoints" description="Every request needs an API key: Authorization: Bearer chr_…" bodyClassName="p-0">
          <ul className="divide-y divide-neutral-200">
            {endpoints.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="flex min-w-0 items-center gap-2 font-mono text-[13px]">
                    <span className="rounded bg-[#e9f7ef] px-1.5 py-0.5 text-[11px] font-semibold text-[#17663a]">GET</span>
                    <span className="truncate text-night">{e.path}</span>
                  </p>
                  <p className="text-[13.5px] text-slate">{e.summary}</p>
                  {e.params.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {e.params.map((p) => (
                        <Tag key={p.name}>
                          {p.name}
                          {p.required ? "*" : ""}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
                <CopyButton text={`${site.url}${e.path}`} label="Copy URL" className="shrink-0 self-start border-neutral-200 bg-card text-slate hover:text-night" />
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Traffic" description="Requests per day, last 14 days.">
            <div className="flex items-end justify-between gap-4">
              <p className="text-[28px] leading-none font-bold tracking-[-0.03em] text-night tabular-nums">{formatNumber(days.reduce((a, d) => a + d.count, 0))}</p>
              <Sparkbars values={days.map((d) => d.count)} height={40} />
            </div>
            <p className="mt-2 text-[12.5px] text-slate">Counted across all versions of {api.slug}.</p>
          </Card>
          <Card title="Details">
            <KeyValue
              items={[
                ["Type", def.kind === "dataset" ? "Dataset" : `Block · ${blockById.get(def.block)?.name ?? def.block}`],
                ["Version", `v${n} · revision ${version.revision}`],
                ["Published", version.publishedAt ? formatDate(version.publishedAt) : "Not yet"],
                ["Updated", timeAgo(version.updatedAt)],
                ["Created by", <span key="c" className="break-all">{api.createdBy}</span>],
              ]}
            />
          </Card>
        </div>
      </div>

      {def.kind === "dataset" && (
        <Card title="Collections" description={`${formatNumber(total)} of ${formatNumber(LIMITS.recordsPerApi)} records used in v${n}.`} bodyClassName="p-0">
          <ul className="grid divide-y divide-neutral-200 md:grid-cols-2 md:divide-y-0">
            {def.collections.map((c) => (
              <li key={c.slug} className="flex items-center justify-between gap-4 px-5 py-4 md:border-b md:border-neutral-200">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`${base}/data?collection=${c.slug}`} className="font-semibold text-night no-underline hover:text-ion">
                    {c.name}
                  </Link>
                  <p className="truncate text-[13px] text-slate">
                    <span className="font-mono">{c.slug}</span> · {c.fields.length} field{c.fields.length === 1 ? "" : "s"}
                    {c.filters.length ? ` · ${c.filters.length} filter${c.filters.length === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <p className="font-mono text-[14px] text-night tabular-nums">{formatNumber(counts.get(c.slug) ?? 0)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
