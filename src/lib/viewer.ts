import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { ssoConfigured, webrizen } from "@/lib/webrizen";

export type Viewer = { user: User; isAdmin: boolean };

/**
 * Claims from the ID token Webrizen SSO issued at sign-in. The token was
 * verified by the SDK at login and lives in our encrypted session cookie, so
 * its payload can be read directly.
 */
function idTokenClaims(idToken: string | undefined): Record<string, unknown> {
  const payload = idToken?.split(".")[1];
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

/** Emergency fallback only; platform admins come from the SSO `platform_admin` claim. */
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
  const platformAdmin = idTokenClaims(session.idToken).platform_admin === true;
  const profile = { email, name: name || null, image, lastSeenAt: new Date() };
  const [user] = await getDb()
    .insert(users)
    .values({ ssoSub, ...profile })
    .onConflictDoUpdate({ target: users.ssoSub, set: profile })
    .returning();
  return { user, isAdmin: platformAdmin || (emailVerified && adminEmails().has(email.toLowerCase())) };
});

export async function requireViewer(returnTo = "/dashboard"): Promise<Viewer> {
  const viewer = await getViewer();
  // Via a page, not the login route itself: client navigations and prefetches
  // fetch redirect targets, and every hit on the login route restarts OAuth.
  if (!viewer) redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  return viewer;
}
