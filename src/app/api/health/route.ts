import { NextResponse } from "next/server";

/** Uptime check. Doesn't touch the database. */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
