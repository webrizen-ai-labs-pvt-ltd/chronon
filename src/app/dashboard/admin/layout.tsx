import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getViewer } from "@/lib/viewer";
import { ssoConfigured } from "@/lib/webrizen";

export const metadata = { title: { default: "Admin", template: "%s · Admin · Chronon" }, robots: { index: false } };

/**
 * The admin console frame. Pages still check access themselves (layouts and
 * pages render in parallel); this only needs the viewer for the account card.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!ssoConfigured()) notFound();
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return children; // the page redirects to sign-in or 404s
  return <AdminShell user={{ name: viewer.user.name, email: viewer.user.email }}>{children}</AdminShell>;
}
