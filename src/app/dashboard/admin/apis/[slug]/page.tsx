import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getApi } from "@/lib/builder/repo";

/** Opens the newest version of an API. */
export default async function ApiIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAdmin(`/dashboard/admin/apis/${slug}`);
  const found = await getApi(slug);
  if (!found || !found.versions.length) notFound();
  redirect(`/dashboard/admin/apis/${slug}/v${found.versions[found.versions.length - 1].version}`);
}
