import { workspace, type WorkspaceParams } from "../load";
import { ApiSettings } from "./api-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: WorkspaceParams }) {
  const { api } = await workspace(params);
  return <ApiSettings key={api.updatedAt.toISOString()} slug={api.slug} name={api.name} summary={api.summary} status={api.status} />;
}
