import { blockById } from "@/lib/builder/blocks";
import { describeEndpoints } from "@/lib/builder/describe";
import { site } from "@/lib/site";
import { workspace, type WorkspaceParams } from "../load";
import { Playground } from "./playground";

export const dynamic = "force-dynamic";
export const metadata = { title: "Playground" };

export default async function PlaygroundPage({ params }: { params: WorkspaceParams }) {
  const { api, version, def, n } = await workspace(params);
  const example = def.kind === "block" ? blockById.get(def.block)?.example : undefined;
  return <Playground slug={api.slug} version={n} state={version.state} endpoints={describeEndpoints(def, api.slug, n)} blockExample={example} origin={site.url} />;
}
