import Link from "next/link";
import { Card, StatePill, Table, tdCls, thCls } from "@/components/admin/kit";
import { formatDate, timeAgo } from "@/lib/format";
import { workspace, type WorkspaceParams } from "../load";
import { DiscardDraftButton, NextVersionButton, PublishButton, StateButton } from "../version-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Versions" };

const lifecycle = [
  ["draft", "Private. Edit anything; nothing is served."],
  ["published", "Live. Additive schema changes only; records stay editable."],
  ["deprecated", "Still live, with a Deprecation header pointing at the newest version."],
  ["retired", "Answers 410 Gone. Read-only."],
] as const;

export default async function VersionsPage({ params }: { params: WorkspaceParams }) {
  const { api, versions } = await workspace(params);
  const latest = versions[versions.length - 1];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card
        title="Versions"
        description="Each major version has its own URL, schema and records."
        actions={latest && latest.state !== "draft" ? <NextVersionButton slug={api.slug} version={latest.version} /> : undefined}
        bodyClassName="p-0"
      >
        <Table minWidth={680}>
          <thead>
            <tr>
              <th className={thCls}>Version</th>
              <th className={thCls}>State</th>
              <th className={thCls}>Published</th>
              <th className={thCls}>Updated</th>
              <th className={`${thCls} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...versions].reverse().map((v) => (
              <tr key={v.id}>
                <td className={tdCls}>
                  <Link href={`/dashboard/admin/apis/${api.slug}/v${v.version}`} className="font-mono text-[13.5px] font-semibold text-night no-underline hover:text-ion">
                    /v{v.version}/{api.slug}
                  </Link>
                </td>
                <td className={tdCls}>
                  <StatePill state={v.state} />
                </td>
                <td className={`${tdCls} text-slate`}>{v.publishedAt ? formatDate(v.publishedAt) : "—"}</td>
                <td className={`${tdCls} text-slate`}>{timeAgo(v.updatedAt)}</td>
                <td className={tdCls}>
                  <div className="flex justify-end gap-2">
                    {v.state === "draft" && (
                      <>
                        {v.version > 1 && <DiscardDraftButton slug={api.slug} version={v.version} size="xs" />}
                        <PublishButton slug={api.slug} version={v.version} size="xs" primary={false} />
                      </>
                    )}
                    {v.state === "published" && <StateButton slug={api.slug} version={v.version} to="deprecated" size="xs" />}
                    {v.state === "deprecated" && (
                      <>
                        <StateButton slug={api.slug} version={v.version} to="published" size="xs" />
                        <StateButton slug={api.slug} version={v.version} to="retired" size="xs" />
                      </>
                    )}
                    {v.state === "retired" && <StateButton slug={api.slug} version={v.version} to="deprecated" size="xs" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title="Lifecycle">
        <ol className="flex flex-col gap-4">
          {lifecycle.map(([state, text]) => (
            <li key={state} className="flex flex-col gap-1.5">
              <StatePill state={state} className="self-start" />
              <p className="text-[13.5px] leading-relaxed text-ink-2">{text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 border-t border-neutral-200 pt-4 text-[13px] leading-relaxed text-slate">
          Breaking change? Start the next version, make the change there, publish it, then deprecate the old one so clients can migrate.
        </p>
      </Card>
    </div>
  );
}
