import { AuditList } from "@/components/admin/audit-list";
import { Card } from "@/components/admin/kit";
import { listAudit } from "@/lib/builder/repo";
import { workspace, type WorkspaceParams } from "../load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

export default async function ApiActivityPage({ params }: { params: WorkspaceParams }) {
  const { api } = await workspace(params);
  const entries = await listAudit({ apiId: api.id, limit: 200 });
  return (
    <Card title="Activity" description="Every change to this API, across all versions." bodyClassName="p-0">
      <AuditList entries={entries} />
    </Card>
  );
}
