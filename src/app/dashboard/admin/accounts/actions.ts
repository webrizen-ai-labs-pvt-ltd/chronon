"use server";

import { revalidatePath } from "next/cache";
import { setBanned, setTier } from "@/lib/accounts";
import { clearKeyCache } from "@/lib/api/with-api-key";
import { isTier } from "@/lib/limits";
import { getViewer } from "@/lib/viewer";

type Res = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) throw new Error("Not allowed");
  return viewer;
}

export async function setTierAction(userId: string, tier: string): Promise<Res> {
  await requireAdmin();
  if (!isTier(tier)) return { ok: false, error: "Unknown tier." };
  await setTier(userId, tier);
  clearKeyCache();
  revalidatePath("/dashboard/admin/accounts");
  return { ok: true };
}

export async function setBannedAction(userId: string, banned: boolean, reason: string): Promise<Res> {
  const viewer = await requireAdmin();
  if (userId === viewer.user.id) return { ok: false, error: "You can't suspend yourself." };
  await setBanned(userId, banned, reason.slice(0, 200));
  clearKeyCache();
  revalidatePath("/dashboard/admin/accounts");
  return { ok: true };
}
