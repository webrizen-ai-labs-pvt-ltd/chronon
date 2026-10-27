import { createWebrizenAuth, fromEnv, type WebrizenAuth } from "@webrizen/sso/next";

/*
 * Shared by server code (through lib/webrizen.ts, which adds the server-only guard) and by
 * proxy.ts, which can't import server-only modules.
 */

let instance: WebrizenAuth | undefined;

/** True when the WEBRIZEN_SSO_* variables are set (they're optional for API-only development). */
export function ssoConfigured() {
  return Boolean(
    process.env.WEBRIZEN_SSO_ISSUER && process.env.WEBRIZEN_SSO_CLIENT_ID && process.env.WEBRIZEN_SSO_SESSION_SECRET,
  );
}

/** "Sign in with Webrizen". Created lazily so builds don't need SSO credentials. */
export function webrizen(): WebrizenAuth {
  // Chronon keys belong to people, not organizations, so we ask for identity scopes only.
  // offline_access lets the proxy refresh sessions instead of sending people back to sign in.
  instance ??= createWebrizenAuth(
    fromEnv({
      scopes: ["openid", "profile", "email", "offline_access"],
      cookieName: "chronon_session",
      errorPath: "/sign-in",
    }),
  );
  return instance;
}
