import "server-only";
import { createWebrizenAuth, fromEnv } from "@webrizen/sso/next";

type WebrizenAuth = ReturnType<typeof createWebrizenAuth>;
let instance: WebrizenAuth | undefined;

/** True when the WEBRIZEN_SSO_* variables are set (they're optional for API-only development). */
export function ssoConfigured() {
  return Boolean(
    process.env.WEBRIZEN_SSO_ISSUER && process.env.WEBRIZEN_SSO_CLIENT_ID && process.env.WEBRIZEN_SSO_SESSION_SECRET,
  );
}

/** "Sign in with Webrizen". Created lazily so builds don't need SSO credentials. */
export function webrizen(): WebrizenAuth {
  // Chronon keys belong to people, not organizations, so we only ask for identity scopes.
  instance ??= createWebrizenAuth(fromEnv({ scopes: ["openid", "profile", "email"], cookieName: "chronon_session" }));
  return instance;
}
