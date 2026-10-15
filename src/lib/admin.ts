import "server-only";
import { notFound } from "next/navigation";
import { getViewer, requireViewer, type Viewer } from "@/lib/viewer";
import { ssoConfigured } from "@/lib/webrizen";

/**
 * Guards an admin page. Layouts and pages render in parallel, so every admin
 * page calls this itself rather than trusting the layout.
 */
export async function requireAdmin(returnTo: string): Promise<Viewer> {
  if (!ssoConfigured()) notFound();
  const viewer = await requireViewer(returnTo);
  if (!viewer.isAdmin) notFound();
  return viewer;
}

/** Guards a server action or route handler; returns the actor recorded in the audit log. */
export async function adminActor(): Promise<string> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) throw new Error("Not allowed");
  return viewer.user.email;
}
