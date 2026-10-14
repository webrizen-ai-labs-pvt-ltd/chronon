import { NextResponse } from "next/server";
import { site } from "@/lib/site";

export type ErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "account_suspended"
  | "rate_limited"
  | "quota_exceeded"
  | "too_many_failed_attempts"
  | "invalid_request"
  | "not_found"
  | "internal_error";

const docsFor: Partial<Record<ErrorCode, string>> = {
  missing_api_key: "/docs/authentication",
  invalid_api_key: "/docs/authentication",
  account_suspended: "/docs/limits#fair-use",
  rate_limited: "/docs/limits",
  quota_exceeded: "/docs/limits",
  too_many_failed_attempts: "/docs/authentication",
};

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
  "Access-Control-Expose-Headers":
    "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Quota-Limit, X-Quota-Remaining, X-Quota-Reset, Retry-After",
  "Access-Control-Max-Age": "86400",
};

/** Standard error body: { "error": { "code", "message", "docs" } } */
export function apiError(status: number, code: ErrorCode, message: string, headers: Record<string, string> = {}) {
  const docs = docsFor[code];
  return NextResponse.json(
    { error: { code, message, ...(docs ? { docs: `${site.url}${docs}` } : {}) } },
    { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...headers } },
  );
}

export function apiJson(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store", ...init.headers },
  });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
