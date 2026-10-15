import { PageHeader } from "@/components/admin/kit";
import { requireAdmin } from "@/lib/admin";
import { BLOCKS } from "@/lib/builder/blocks";
import { NewApiForm } from "./new-api-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New API" };

export default async function NewApiPage() {
  await requireAdmin("/dashboard/admin/apis/new");
  return (
    <>
      <PageHeader
        title="New API"
        description="Pick what you're building. It starts as a private draft: nothing is served until you publish."
      />
      <NewApiForm blocks={BLOCKS.map((b) => ({ id: b.id, name: b.name, summary: b.summary }))} />
    </>
  );
}
