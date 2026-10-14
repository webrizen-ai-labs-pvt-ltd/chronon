/** Vendored from webrizen-sso/packages/sdk (MIT); see ./index.ts. */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import {
  finishLogin,
  logoutUrl,
  type PendingLogin,
  refreshSession,
  safeReturnTo,
  seal,
  startLogin,
  unseal,
  type WebrizenConfig,
  type WebrizenSession,
} from "./index";

export * from "./index";

/**
 * Next.js App Router integration.
 *
 * ```ts
 * // lib/webrizen.ts
 * export const webrizen = createWebrizenAuth({ ...fromEnv() });
 * // app/api/auth/webrizen/[action]/route.ts
 * export const GET = webrizen.handler;
 * ```
 * Routes: /login, /callback, /logout, /refresh under the handler's folder.
 */
export function createWebrizenAuth(cfg: WebrizenConfig) {
  const name = cfg.cookieName ?? "webrizen_session";
  const pendingName = `${name}_pending`;
  const maxAge = cfg.sessionMaxAge ?? 60 * 60 * 24 * 7;
  const secure = cfg.redirectUri.startsWith("https://");
  // Redirect relative to the configured app URL, never the (proxy-dependent) request host.
  const appOrigin = new URL(cfg.redirectUri).origin;
  const cookieOpts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

  async function readSession(): Promise<WebrizenSession | null> {
    const jar = await cookies();
    return unseal<WebrizenSession>(jar.get(name)?.value, cfg.sessionSecret);
  }

  async function writeSession(res: NextResponse, session: WebrizenSession) {
    res.cookies.set(name, await seal(session, cfg.sessionSecret, maxAge), { ...cookieOpts, maxAge });
  }

  async function handler(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
    const { action } = await ctx.params;
    const url = new URL(req.url);

    if (action === "login") {
      const prompt = url.searchParams.get("prompt") as "login" | "select_account" | "create" | null;
      const { url: authorizeUrl, pending } = await startLogin(cfg, {
        returnTo: url.searchParams.get("returnTo") ?? undefined,
        prompt: prompt ?? undefined,
        loginHint: url.searchParams.get("login_hint") ?? undefined,
      });
      const res = NextResponse.redirect(authorizeUrl);
      res.cookies.set(pendingName, await seal(pending, cfg.sessionSecret, 600), { ...cookieOpts, maxAge: 600 });
      return res;
    }

    if (action === "callback") {
      const pending = await unseal<PendingLogin>(req.cookies.get(pendingName)?.value, cfg.sessionSecret);
      if (!pending) return NextResponse.redirect(new URL("/?error=login_expired", appOrigin));
      if (url.searchParams.get("error")) {
        const res = NextResponse.redirect(new URL(`/?error=${encodeURIComponent(url.searchParams.get("error")!)}`, appOrigin));
        res.cookies.delete(pendingName);
        return res;
      }
      // Rebuild the callback URL from the registered redirect URI so proxies can't skew it.
      const callbackUrl = new URL(cfg.redirectUri);
      callbackUrl.search = url.search;
      const session = await finishLogin(cfg, callbackUrl, pending);
      const res = NextResponse.redirect(new URL(pending.returnTo, appOrigin));
      res.cookies.delete(pendingName);
      await writeSession(res, session);
      return res;
    }

    if (action === "refresh") {
      const current = await readSession();
      const next = current && (await refreshSession(cfg, current).catch(() => null));
      const back = new URL(safeReturnTo(url.searchParams.get("returnTo")), appOrigin);
      if (!next) return NextResponse.redirect(new URL(`/api/auth/webrizen/login?returnTo=${encodeURIComponent(back.pathname)}`, appOrigin));
      const res = NextResponse.redirect(back);
      await writeSession(res, next);
      return res;
    }

    if (action === "logout") {
      const session = await readSession();
      const global = url.searchParams.get("global") !== "false";
      const res = NextResponse.redirect(global ? await logoutUrl(cfg, session) : new URL("/", appOrigin));
      res.cookies.delete(name);
      return res;
    }

    return new NextResponse("Not found", { status: 404 });
  }

  return {
    handler,
    /** Current session in Server Components, Route Handlers and Server Actions. */
    getSession: readSession,
    /** Like getSession, but redirects to Webrizen sign-in when signed out. */
    async requireSession(returnTo = "/") {
      const session = await readSession();
      if (!session) redirect(`/api/auth/webrizen/login?returnTo=${encodeURIComponent(returnTo)}`);
      return session;
    },
  };
}

/** Reads the standard WEBRIZEN_SSO_* environment variables. */
export function fromEnv(overrides: Partial<WebrizenConfig> = {}): WebrizenConfig {
  const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";
  const cfg: WebrizenConfig = {
    issuer: process.env.WEBRIZEN_SSO_ISSUER ?? "",
    clientId: process.env.WEBRIZEN_SSO_CLIENT_ID ?? "",
    clientSecret: process.env.WEBRIZEN_SSO_CLIENT_SECRET || undefined,
    sessionSecret: process.env.WEBRIZEN_SSO_SESSION_SECRET ?? "",
    redirectUri: `${appUrl}/api/auth/webrizen/callback`,
    postLogoutRedirectUri: appUrl,
    ...overrides,
  };
  for (const k of ["issuer", "clientId", "sessionSecret"] as const) {
    if (!cfg[k]) throw new Error(`[webrizen] missing config: ${k}. Set the WEBRIZEN_SSO_* environment variables.`);
  }
  return cfg;
}
