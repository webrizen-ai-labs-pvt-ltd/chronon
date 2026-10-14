import type { NextRequest } from "next/server";
import { webrizen } from "@/lib/webrizen";

/** /api/auth/webrizen/{login,callback,logout,refresh} */
export function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  return webrizen().handler(req, ctx);
}
