import Link from "next/link";
import type { ApiAuditEntry } from "@/lib/db/schema";
import { timeAgo } from "@/lib/format";
import { EmptyState, Table, Tag, tdCls, thCls } from "./kit";
import { RollbackButton } from "./rollback-button";

const actionLabels: Record<string, string> = {
  "api.create": "Created",
  "api.import": "Imported",
  "api.update": "Renamed",
  "api.enable": "Enabled",
  "api.disable": "Disabled",
  "api.delete": "Deleted",
  "schema.update": "Schema",
  "schema.rollback": "Rollback",
  "record.create": "Record added",
  "record.update": "Record edited",
  "record.delete": "Records deleted",
  "record.import": "Import",
  "version.publish": "Published",
  "version.create": "New version",
  "version.deprecated": "Deprecated",
  "version.retired": "Retired",
  "version.published": "Restored",
  "version.discard": "Discarded",
};

/** The builder's audit trail, newest first. Schema changes can be rolled back. */
export function AuditList({ entries, showApi = false, rollback = true }: { entries: ApiAuditEntry[]; showApi?: boolean; rollback?: boolean }) {
  if (!entries.length) return <EmptyState title="No activity yet" description="Every change made in the builder is recorded here, with who made it." />;
  return (
    <Table minWidth={showApi ? 820 : 720}>
      <thead>
        <tr>
          <th className={thCls}>When</th>
          {showApi && <th className={thCls}>API</th>}
          <th className={thCls}>Change</th>
          <th className={thCls}>By</th>
          <th className={`${thCls} text-right`} />
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td className={`${tdCls} whitespace-nowrap text-slate`} title={e.createdAt.toISOString()}>
              {timeAgo(e.createdAt)}
            </td>
            {showApi && (
              <td className={tdCls}>
                {e.apiId ? (
                  <Link href={`/dashboard/admin/apis/${e.apiSlug}${e.version ? `/v${e.version}` : ""}`} className="font-mono text-[13px] text-night no-underline hover:text-ion">
                    {e.apiSlug}
                    {e.version ? ` v${e.version}` : ""}
                  </Link>
                ) : (
                  <span className="font-mono text-[13px] text-slate line-through">{e.apiSlug}</span>
                )}
              </td>
            )}
            <td className={tdCls}>
              <div className="flex flex-col gap-1">
                <Tag className="self-start">{actionLabels[e.action] ?? e.action}</Tag>
                <span className="text-[14px] text-night">{e.summary}</span>
              </div>
            </td>
            <td className={`${tdCls} text-[13px] break-all text-slate`}>{e.actor}</td>
            <td className={`${tdCls} text-right`}>{rollback && e.action === "schema.update" && e.before && e.apiId ? <RollbackButton id={e.id} slug={e.apiSlug} /> : null}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
