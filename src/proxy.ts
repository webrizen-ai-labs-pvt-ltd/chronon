import { NextResponse, type NextRequest } from "next/server";
import { ssoConfigured, webrizen } from "@/lib/webrizen-core";

/**
 * 1. Development only: keeps the app on APP_URL's host. Sign-in cookies are
 *    per-host, so starting on localhost:3001 and returning to the registered
 *    127.0.0.1:3001 callback fails the OAuth state check.
 * 2. Keeps Webrizen sessions fresh: refreshes the 10-minute access token before
 *    it expires, and signs people out here when Webrizen revoked their access.
 */
export function proxy(req: NextRequest) {
  const wrongHost = devHostRedirect(req);
  if (wrongHost) return wrongHost;
  // Key-authenticated API calls carry no session cookie; skip them cheaply.
  if (!ssoConfigured() || req.nextUrl.pathname.startsWith("/v1/")) return NextResponse.next();
  return webrizen().proxy(req);
}

function devHostRedirect(req: NextRequest) {
  if (process.env.NODE_ENV !== "development" || !process.env.APP_URL) return null;
  const canonical = new URL(process.env.APP_URL);
  // The Host header, not req.nextUrl: in dev Next reports localhost for every request.
  const host = req.headers.get("host");
  if (!host || host === canonical.host) return null;
  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, canonical);
  // Not a 307: the dev server treats localhost and 127.0.0.1 as one origin and
  // rewrites the Location to a relative path, which loops.
  const target = url.toString().replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
  return new NextResponse(`<!doctype html><meta http-equiv="refresh" content="0;url=${target}"><a href="${target}">Continue on ${canonical.host}</a>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon).*)"],
};
