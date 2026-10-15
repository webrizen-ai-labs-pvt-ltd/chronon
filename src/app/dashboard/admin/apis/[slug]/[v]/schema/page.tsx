import { redirect } from "next/navigation";
import { workspace, type WorkspaceParams } from "../load";
import { SchemaDesigner } from "./schema-designer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schema" };

export default async function SchemaPage({ params }: { params: WorkspaceParams }) {
  const { api, version, def, n, base } = await workspace(params);
  if (def.kind !== "dataset") redirect(`${base}/configure`);
  if (version.state === "retired") redirect(base);
  return <SchemaDesigner key={`${version.id}:${version.revision}`} slug={api.slug} version={n} initial={def} live={version.state === "draft" ? null : def} />;
}
