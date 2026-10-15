import { redirect } from "next/navigation";
import { blockById } from "@/lib/builder/blocks";
import { workspace, type WorkspaceParams } from "../load";
import { BlockSettingsForm } from "./block-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configure" };

export default async function ConfigurePage({ params }: { params: WorkspaceParams }) {
  const { api, version, def, n, base } = await workspace(params);
  if (def.kind !== "block") redirect(`${base}/schema`);
  const block = blockById.get(def.block);
  if (!block) redirect(base);
  return (
    <BlockSettingsForm
      key={version.revision}
      slug={api.slug}
      version={n}
      blockName={block.name}
      blockSummary={block.summary}
      settings={block.settings}
      initial={def.config}
      definition={def}
      readOnly={version.state === "retired"}
    />
  );
}
