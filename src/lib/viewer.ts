import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { ssoConfigured, webrizen } from "@/lib/webrizen";

export type Viewer = { user: User; isAdmin: boolean };

function adminEmails() {
  return new Set(
    (process.env.CHRONON_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * The signed-in developer, or null. Creates their Chronon account on first
 * visit and keeps name/email in sync with Webrizen SSO.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Without SSO credentials nobody can be signed in (local API-only development).
  if (!ssoConfigured()) return null;
  const session = await webrizen().getSession();
  if (!session) return null;
  const { id: ssoSub, email, name, image, emailVerified } = session.user;
  const profile = { email, name: name || null, image, lastSeenAt: new Date() };
  const [user] = await getDb()
    .insert(users)
    .values({ ssoSub, ...profile })
    .onConflictDoUpdate({ target: users.ssoSub, set: profile })
    .returning();
  return { user, isAdmin: emailVerified && adminEmails().has(email.toLowerCase()) };
});

export async function requireViewer(returnTo = "/dashboard"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/api/auth/webrizen/login?returnTo=${encodeURIComponent(returnTo)}`);
  return viewer;
}
