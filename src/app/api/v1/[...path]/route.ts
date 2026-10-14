import { apiError, preflight } from "@/lib/api/respond";

/** Any unknown /v1 path gets a JSON 404 instead of an HTML page. */
function notFound() {
  return apiError(404, "not_found", "Unknown endpoint. See GET /v1 for the list.");
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = preflight;
