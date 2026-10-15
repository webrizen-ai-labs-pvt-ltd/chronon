import { AuditList } from "@/components/admin/audit-list";
import { Card, PageHeader } from "@/components/admin/kit";
import { MigrateNotice } from "@/components/admin/migrate-notice";
import { requireAdmin } from "@/lib/admin";
import { builderReady, listAudit } from "@/lib/builder/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  await requireAdmin("/dashboard/admin/activity");
  const ready = await builderReady();
  const entries = ready ? await listAudit({ limit: 200 }) : [];
  return (
    <>
      <PageHeader title="Activity" description="The audit trail for every API: who changed what, and when. The latest 200 entries." />
      {!ready && <MigrateNotice />}
      <Card bodyClassName="p-0">
        <AuditList entries={entries} showApi />
      </Card>
    </>
  );
}
