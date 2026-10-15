import type { NextRequest } from "next/server";
import { apiError, preflight } from "@/lib/api/respond";
import { serveRequest } from "@/lib/builder/serve";

/** Every /v1/<api>/… path: APIs built in the admin builder (and built-ins like menus). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return serveRequest(req, 1, (await ctx.params).path);
}

function methodNotAllowed() {
  return apiError(404, "not_found", "Chronon APIs are read-only: use GET. See GET /v1 for the list.");
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = preflight;
