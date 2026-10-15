import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { requireAdmin } from "@/lib/admin";
import { getVersion, parseDefinition } from "@/lib/builder/repo";

export type WorkspaceParams = Promise<{ slug: string; v: string }>;

/** Loads the API version a workspace page is about (once per request), checking admin access. */
export const loadWorkspace = cache(async (slug: string, v: string) => {
  await requireAdmin(`/dashboard/admin/apis/${slug}/${v}`);
  const n = /^v(\d{1,3})$/.exec(v);
  if (!n) notFound();
  const found = await getVersion(slug, Number(n[1]));
  if (!found) notFound();
  return { ...found, def: parseDefinition(found.version), n: Number(n[1]), base: `/dashboard/admin/apis/${slug}/${v}` };
});

export async function workspace(params: WorkspaceParams) {
  const { slug, v } = await params;
  return loadWorkspace(slug, v);
}
