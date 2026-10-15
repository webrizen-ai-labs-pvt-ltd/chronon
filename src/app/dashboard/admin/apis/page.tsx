import { Database01, Plus, Upload01 } from "@untitledui/icons";
import Link from "next/link";
import { Card, EmptyState, PageHeader, StatePill, Table, Tag, tdCls, thCls } from "@/components/admin/kit";
import { MigrateNotice } from "@/components/admin/migrate-notice";
import { Button } from "@/components/base/buttons/button";
import { requireAdmin } from "@/lib/admin";
import { blockById } from "@/lib/builder/blocks";
import { LIMITS } from "@/lib/builder/definition";
import { builderReady, listApis } from "@/lib/builder/repo";
import { getDb } from "@/lib/db";
import { apiVersions } from "@/lib/db/schema";
import { formatNumber, timeAgo } from "@/lib/format";
import { ImportBuiltin } from "./import-builtin";

export const dynamic = "force-dynamic";
export const metadata = { title: "APIs" };

export default async function ApisPage() {
  await requireAdmin("/dashboard/admin/apis");
  const ready = await builderReady();
  const list = ready ? await listApis() : [];
  // Block names come from each API's latest definition.
  const latestDefs = ready
    ? await getDb().select({ apiId: apiVersions.apiId, version: apiVersions.version, definition: apiVersions.definition }).from(apiVersions)
    : [];
  const blockOf = (apiId: string) => {
    const defs = latestDefs.filter((d) => d.apiId === apiId).sort((a, b) => b.version - a.version);
    const def = defs[0]?.definition as { kind?: string; block?: string } | undefined;
    return def?.kind === "block" ? blockById.get(def.block ?? "")?.name : undefined;
  };
  const hasMenus = list.some((a) => a.slug === "menus");

  return (
    <>
      <PageHeader
        title="APIs"
        description={`Every API served under /v{n}/. ${list.length} of ${LIMITS.apis} slots used.`}
        actions={
          <>
            <Button href="/dashboard/admin/apis/new/sheet" size="md" color="secondary" iconLeading={<Upload01 data-icon="leading" />}>
              Import spreadsheet
            </Button>
            <Button href="/dashboard/admin/apis/new" size="md" iconLeading={<Plus data-icon="leading" />}>
              New API
            </Button>
          </>
        }
      />
      {!ready && <MigrateNotice />}

      <Card bodyClassName="p-0">
        {list.length === 0 && hasMenus ? (
          <EmptyState
            icon={<Database01 />}
            title="No APIs yet"
            description="Model a dataset or wrap a utility block. You can publish it in minutes."
            action={
              <Button href="/dashboard/admin/apis/new" size="sm" iconLeading={<Plus data-icon="leading" />}>
                New API
              </Button>
            }
          />
        ) : (
          <Table minWidth={860}>
            <thead>
              <tr>
                <th className={thCls}>API</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Versions</th>
                <th className={`${thCls} text-right`}>Records</th>
                <th className={thCls}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {!hasMenus && (
                <tr className="bg-[#faf9ff]">
                  <td className={tdCls}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-night">Regional menus</span>
                      <span className="text-[13px] text-slate">Served from code. Import it to edit its schema and data here.</span>
                    </div>
                  </td>
                  <td className={tdCls}>
                    <Tag>dataset</Tag>
                  </td>
                  <td className={tdCls}>
                    <StatePill state="builtin" label="Built-in v1" />
                  </td>
                  <td className={`${tdCls} text-right font-mono text-slate`}>—</td>
                  <td className={tdCls}>{ready ? <ImportBuiltin /> : <span className="text-[13px] text-slate">Migrate first</span>}</td>
                </tr>
              )}
              {list.map((a) => {
                const block = blockOf(a.id);
                return (
                  <tr key={a.id} className="group transition hover:bg-paper/60">
                    <td className={tdCls}>
                      <Link href={`/dashboard/admin/apis/${a.slug}`} className="flex flex-col gap-0.5 no-underline">
                        <span className="font-semibold text-night group-hover:text-ion">{a.name}</span>
                        <span className="font-mono text-[12px] text-slate">/{a.slug}</span>
                      </Link>
                    </td>
                    <td className={tdCls}>
                      <Tag>{block ? `block · ${block}` : "dataset"}</Tag>
                    </td>
                    <td className={tdCls}>
                      <div className="flex flex-wrap gap-1.5">
                        {a.status === "disabled" && <StatePill state="disabled" />}
                        {a.versions.map((v) => (
                          <StatePill key={v.id} state={v.state} label={`v${v.version} ${v.state}`} />
                        ))}
                      </div>
                    </td>
                    <td className={`${tdCls} text-right font-mono tabular-nums`}>{a.kind === "dataset" ? formatNumber(a.records) : "—"}</td>
                    <td className={`${tdCls} text-slate`}>{timeAgo(a.versions.reduce<Date>((d, v) => (v.updatedAt > d ? v.updatedAt : d), a.updatedAt))}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
