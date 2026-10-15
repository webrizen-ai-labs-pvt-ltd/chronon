import type { NextRequest } from "next/server";
import { apiError, preflight } from "@/lib/api/respond";
import { serveRequest } from "@/lib/builder/serve";

/** /v2/… and later major versions of builder APIs. /v1 has its own folder. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ version: string; path: string[] }> }) {
  const { version, path } = await ctx.params;
  const n = /^v([1-9]\d{0,2})$/.exec(version);
  if (!n) return apiError(404, "not_found", "Unknown endpoint. See GET /v1 for the list.");
  return serveRequest(req, Number(n[1]), path);
}

function methodNotAllowed() {
  return apiError(404, "not_found", "Chronon APIs are read-only: use GET.");
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = preflight;
