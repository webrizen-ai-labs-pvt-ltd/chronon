"use server";

import { revalidatePath } from "next/cache";
import { createKey, revokeKey } from "@/lib/accounts";
import { clearKeyCache } from "@/lib/api/with-api-key";
import { getViewer } from "@/lib/viewer";

export type CreateKeyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "created"; id: string; token: string; name: string };

export async function createKeyAction(_prev: CreateKeyState, form: FormData): Promise<CreateKeyState> {
  const viewer = await getViewer();
  if (!viewer) return { status: "error", message: "Your session expired. Sign in again." };
  if (viewer.user.bannedAt) return { status: "error", message: "This account is suspended." };

  const name = String(form.get("name") ?? "");
  const result = await createKey(viewer.user.id, name);
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/dashboard");
  return { status: "created", id: result.id, token: result.token, name: name.trim() || "Untitled key" };
}

export async function revokeKeyAction(form: FormData) {
  const viewer = await getViewer();
  if (!viewer) return;
  const id = String(form.get("id") ?? "");
  if (await revokeKey(viewer.user.id, id)) clearKeyCache(id);
  revalidatePath("/dashboard");
}
