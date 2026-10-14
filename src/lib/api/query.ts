import type { NextRequest } from "next/server";
import type { z } from "zod";
import { apiError } from "./respond";

/** Parses the query string with `schema`, or returns a 400 response describing the first problem. */
export function parseQuery<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): { ok: true; data: z.output<S> } | { ok: false; response: Response } {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const result = schema.safeParse(params);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const field = issue?.path.join(".") || "query";
  return { ok: false, response: apiError(400, "invalid_request", `Invalid \`${field}\`: ${issue?.message ?? "bad value"}.`) };
}
