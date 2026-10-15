import { requireAdmin } from "@/lib/admin";
import { site } from "@/lib/site";
import { SheetImport } from "./sheet-import";

export const dynamic = "force-dynamic";
export const metadata = { title: "New API from a spreadsheet" };

export default async function SheetImportPage() {
  await requireAdmin("/dashboard/admin/apis/new/sheet");
  return <SheetImport host={site.url.replace(/^https?:\/\//, "")} />;
}
