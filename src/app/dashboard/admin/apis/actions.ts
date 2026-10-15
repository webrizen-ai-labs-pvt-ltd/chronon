"use server";

import { revalidatePath } from "next/cache";
import { adminActor } from "@/lib/admin";
import * as repo from "@/lib/builder/repo";
import type { RecordInput } from "@/lib/builder/records";
import { clearServeCache, loadForPreview, run } from "@/lib/builder/serve";

/**
 * Server actions behind the API builder. Every action re-checks admin access,
 * delegates to the repository (which validates and audits), then refreshes
 * the serving cache and the admin pages.
 */

type Res = { ok: true } | { ok: false; error: string };

function done(slug?: string) {
  clearServeCache();
  revalidatePath("/dashboard/admin", "layout");
  if (slug) revalidatePath(`/dashboard/admin/apis/${slug}`, "layout");
}

async function versionId(slug: string, version: number) {
  const found = await repo.getVersion(slug, version);
  if (!found) throw new Error("Version not found");
  return found.version.id;
}

async function apiId(slug: string) {
  const found = await repo.getApi(slug);
  if (!found) throw new Error("API not found");
  return found.api.id;
}

export async function createApiAction(input: { slug: string; name: string; summary: string; kind: "dataset" | "block"; block?: string }) {
  const actor = await adminActor();
  const res = await repo.createApi({ ...input, actor });
  if (res.ok) done(res.value);
  return res;
}

/** Step one of a spreadsheet import: the draft API with its schema. Records follow in batches. */
export async function createFromSheetAction(input: { slug: string; name: string; summary: string; definition: unknown }) {
  const actor = await adminActor();
  const res = await repo.createApi({ ...input, kind: "dataset", actor });
  if (res.ok) done(res.value);
  return res;
}

/** Removes a draft whose spreadsheet import didn't finish. */
export async function abandonImportAction(slug: string): Promise<Res> {
  await adminActor();
  const found = await repo.getApi(slug);
  if (!found) return { ok: true };
  if (found.versions.some((v) => v.state !== "draft")) return { ok: false, error: "This API is already published." };
  return deleteApiAction(slug, slug);
}

export async function importBuiltinAction(slug: "menus"): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.importBuiltin(slug, actor);
  if (res.ok) done(slug);
  return res;
}

export async function saveDefinitionAction(slug: string, version: number, definition: unknown): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.saveDefinition(await versionId(slug, version), definition, actor);
  if (res.ok) done(slug);
  return res;
}

export async function saveRecordAction(slug: string, version: number, collection: string, originalSlug: string | null, input: RecordInput) {
  const actor = await adminActor();
  const res = await repo.saveRecord(await versionId(slug, version), collection, originalSlug, input, actor);
  if (res.ok) done(slug);
  return res;
}

export async function deleteRecordsAction(slug: string, version: number, collection: string, slugs: string[]): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.deleteRecords(await versionId(slug, version), collection, slugs, actor);
  if (res.ok) done(slug);
  return res;
}

export async function importRecordsAction(slug: string, version: number, collection: string, rows: RecordInput[], mode: "upsert" | "replace") {
  const actor = await adminActor();
  const res = await repo.importRecords(await versionId(slug, version), collection, rows, mode, actor);
  if (res.ok) done(slug);
  return res;
}

export async function publishAction(slug: string, version: number): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.publishVersion(await versionId(slug, version), actor);
  if (res.ok) done(slug);
  return res;
}

export async function setVersionStateAction(slug: string, version: number, state: repo.VersionState): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.setVersionState(await versionId(slug, version), state, actor);
  if (res.ok) done(slug);
  return res;
}

export async function nextVersionAction(slug: string) {
  const actor = await adminActor();
  const res = await repo.createNextVersion(await apiId(slug), actor);
  if (res.ok) done(slug);
  return res;
}

export async function discardDraftAction(slug: string, version: number): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.discardDraft(await versionId(slug, version), actor);
  if (res.ok) done(slug);
  return res;
}

export async function updateMetaAction(slug: string, name: string, summary: string): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.updateApiMeta(await apiId(slug), { name, summary, actor });
  if (res.ok) done(slug);
  return res;
}

export async function setApiStatusAction(slug: string, status: "active" | "disabled"): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.setApiStatus(await apiId(slug), status, actor);
  if (res.ok) done(slug);
  return res;
}

export async function deleteApiAction(slug: string, typed: string): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.deleteApi(await apiId(slug), typed, actor);
  if (res.ok) done();
  return res;
}

export async function rollbackAction(auditId: number, slug: string): Promise<Res> {
  const actor = await adminActor();
  const res = await repo.rollbackSchema(auditId, actor);
  if (res.ok) done(slug);
  return res;
}

export type PlaygroundResult = { status: number; ms: number; contentType: string; body: string };

/** Runs a request against any version (drafts included) without an API key or rate limits. */
export async function runPlaygroundAction(slug: string, version: number, path: string, query: string): Promise<PlaygroundResult> {
  await adminActor();
  const t0 = performance.now();
  const loaded = await loadForPreview(await versionId(slug, version));
  const segments = path.split("/").map((s) => s.trim()).filter(Boolean);
  const out = await run(loaded, segments, new URLSearchParams(query.replace(/^\?/, "")), `/v${version}/${slug}`);
  const ms = Math.round((performance.now() - t0) * 10) / 10;
  if ("raw" in out) return { status: out.status, ms, contentType: out.contentType, body: out.raw };
  const body = "error" in out ? { error: out.error } : out.body;
  return { status: out.status, ms, contentType: "application/json", body: JSON.stringify(body, null, 2) };
}
