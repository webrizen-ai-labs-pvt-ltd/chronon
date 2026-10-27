import type { NextRequest } from "next/server";
import { webrizen } from "@/lib/webrizen";

type Ctx = { params: Promise<{ action: string }> };

/** GET /api/auth/webrizen/{login,callback,logout,refresh} */
export function GET(req: NextRequest, ctx: Ctx) {
  return webrizen().routes.GET(req, ctx);
}

/** POST /api/auth/webrizen/backchannel: Webrizen tells us someone signed out everywhere. */
export function POST(req: NextRequest, ctx: Ctx) {
  return webrizen().routes.POST(req, ctx);
}
