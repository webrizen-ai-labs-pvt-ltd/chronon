"use server";

import { revalidatePath } from "next/cache";
import { setBanned, setTier } from "@/lib/accounts";
import { clearKeyCache } from "@/lib/api/with-api-key";
import { isTier } from "@/lib/limits";
import { getViewer } from "@/lib/viewer";

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) throw new Error("Not allowed");
  return viewer;
}

export async function setTierAction(form: FormData) {
  await requireAdmin();
  const tier = form.get("tier");
  if (!isTier(tier)) return;
  await setTier(String(form.get("userId")), tier);
  clearKeyCache();
  revalidatePath("/dashboard/admin");
}

export async function setBannedAction(form: FormData) {
  const viewer = await requireAdmin();
  const userId = String(form.get("userId"));
  if (userId === viewer.user.id) return; // don't lock yourself out
  await setBanned(userId, form.get("banned") === "true", String(form.get("reason") ?? ""));
  clearKeyCache();
  revalidatePath("/dashboard/admin");
}
