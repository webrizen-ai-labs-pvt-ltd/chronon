/**
 * Vendored from webrizen-sso/packages/sdk (MIT) until @webrizen/sso is published to npm.
 * Then: delete this folder, add "@webrizen/sso" to package.json and import from "@webrizen/sso".
 */
import { EncryptJWT, jwtDecrypt } from "jose";
import * as oidc from "openid-client";

export type WebrizenOrg = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  roles: string[];
  teams: { id: string; name: string }[];
  permissions: Record<string, string[]>;
};

export type WebrizenUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
};

export type WebrizenSession = {
  user: WebrizenUser;
  /** The organization the user signed in to (null if they belong to none). */
  org: WebrizenOrg | null;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  /** Unix seconds when the access token expires. */
  expiresAt: number;
};

export type WebrizenConfig = {
  /** e.g. https://accounts.webrizen.com/api/auth */
  issuer: string;
  clientId: string;
  /** Omit for public clients (PKCE only). */
  clientSecret?: string;
  /** Absolute callback URL registered for this app. */
  redirectUri: string;
  /** Where Webrizen sends users after a global sign-out. */
  postLogoutRedirectUri?: string;
  /** 32+ random characters used to encrypt the session cookie. */
  sessionSecret: string;
  /** Session cookie lifetime in seconds. Default: 7 days. */
  sessionMaxAge?: number;
  scopes?: string[];
  cookieName?: string;
};

export const DEFAULT_SCOPES = ["openid", "profile", "email", "organization", "offline_access"];

/* ------------------------------ OIDC discovery ----------------------------- */

const discovered = new Map<string, Promise<oidc.Configuration>>();

export function getOidcConfig(cfg: Pick<WebrizenConfig, "issuer" | "clientId" | "clientSecret">) {
  const key = `${cfg.issuer}|${cfg.clientId}`;
  let p = discovered.get(key);
  if (!p) {
    const insecure = cfg.issuer.startsWith("http://");
    p = oidc
      .discovery(
        new URL(cfg.issuer),
        cfg.clientId,
        cfg.clientSecret,
        cfg.clientSecret ? oidc.ClientSecretBasic(cfg.clientSecret) : oidc.None(),
        insecure ? { execute: [oidc.allowInsecureRequests] } : undefined,
      )
      .catch((err) => {
        discovered.delete(key);
        throw err;
      });
    discovered.set(key, p);
  }
  return p;
}

/* ----------------------------- Encrypted cookies --------------------------- */

async function keyFrom(secret: string) {
  if (secret.length < 32) throw new Error("[webrizen] sessionSecret must be at least 32 characters");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

export async function seal(data: object, secret: string, maxAgeSeconds: number) {
  return new EncryptJWT({ d: data as Record<string, unknown> })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .encrypt(await keyFrom(secret));
}

export async function unseal<T>(token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, await keyFrom(secret));
    return payload.d as T;
  } catch {
    return null;
  }
}

/* --------------------------------- Flows ---------------------------------- */

export type PendingLogin = { state: string; nonce: string; verifier: string; returnTo: string };

export async function startLogin(
  cfg: WebrizenConfig,
  opts: { returnTo?: string; prompt?: "login" | "select_account" | "create"; loginHint?: string } = {},
) {
  const config = await getOidcConfig(cfg);
  const verifier = oidc.randomPKCECodeVerifier();
  const pending: PendingLogin = {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verifier,
    returnTo: safeReturnTo(opts.returnTo),
  };
  const params: Record<string, string> = {
    redirect_uri: cfg.redirectUri,
    scope: (cfg.scopes ?? DEFAULT_SCOPES).join(" "),
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state: pending.state,
    nonce: pending.nonce,
  };
  if (opts.prompt) params.prompt = opts.prompt;
  if (opts.loginHint) params.login_hint = opts.loginHint;
  return { url: oidc.buildAuthorizationUrl(config, params).href, pending };
}

export async function finishLogin(cfg: WebrizenConfig, callbackUrl: URL, pending: PendingLogin) {
  const config = await getOidcConfig(cfg);
  const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: pending.verifier,
    expectedState: pending.state,
    expectedNonce: pending.nonce,
    idTokenExpected: true,
  });
  return sessionFromTokens(config, tokens);
}

export async function refreshSession(cfg: WebrizenConfig, session: WebrizenSession) {
  if (!session.refreshToken) return null;
  const config = await getOidcConfig(cfg);
  const tokens = await oidc.refreshTokenGrant(config, session.refreshToken);
  return sessionFromTokens(config, tokens, session);
}

async function sessionFromTokens(
  config: oidc.Configuration,
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
  previous?: WebrizenSession,
): Promise<WebrizenSession> {
  const claims: Record<string, unknown> = tokens.claims() ?? {};
  const sub = (claims.sub as string | undefined) ?? previous?.user.id;
  if (!sub) throw new Error("[webrizen] token response has no subject");
  // /userinfo reflects the latest profile, roles and permissions.
  const info = (await oidc.fetchUserInfo(config, tokens.access_token, sub)) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...claims, ...info };

  return {
    user: {
      id: sub,
      email: String(merged.email ?? previous?.user.email ?? ""),
      emailVerified: Boolean(merged.email_verified),
      name: String(merged.name ?? previous?.user.name ?? ""),
      image: (merged.picture as string | undefined) ?? null,
    },
    org: (merged.org as WebrizenOrg | null | undefined) ?? previous?.org ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? previous?.refreshToken,
    idToken: tokens.id_token ?? previous?.idToken,
    expiresAt: Math.floor(Date.now() / 1000) + (tokens.expiresIn() ?? 3600),
  };
}

export async function logoutUrl(cfg: WebrizenConfig, session: WebrizenSession | null) {
  const config = await getOidcConfig(cfg);
  if (!config.serverMetadata().end_session_endpoint) return cfg.postLogoutRedirectUri ?? "/";
  const params: Record<string, string> = { client_id: cfg.clientId };
  if (session?.idToken) params.id_token_hint = session.idToken;
  if (cfg.postLogoutRedirectUri) params.post_logout_redirect_uri = cfg.postLogoutRedirectUri;
  return oidc.buildEndSessionUrl(config, params).href;
}

/* ------------------------------ Authorization ------------------------------ */

/** True when the signed-in member's roles grant `action` on `resource`. */
export function can(session: Pick<WebrizenSession, "org"> | null | undefined, resource: string, action: string) {
  return session?.org?.permissions?.[resource]?.includes(action) ?? false;
}

export function hasRole(session: Pick<WebrizenSession, "org"> | null | undefined, role: string) {
  return session?.org?.roles.includes(role) ?? false;
}

export function safeReturnTo(value?: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}


