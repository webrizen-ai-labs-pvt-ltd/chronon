import { BookOpen01, Database01, Tool01 } from "@untitledui/icons";
import { StatePill } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import { site } from "@/lib/site";
import { loadWorkspace } from "./load";
import { VersionSwitcher, WorkspaceTabs } from "./tabs";
import { PublishButton } from "./version-actions";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; v: string }> }) {
  const { slug, v } = await params;
  return { title: { default: `${slug} ${v}`, template: `%s · ${slug} ${v} · Admin` } };
}

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string; v: string }> }) {
  const { slug, v } = await params;
  const { api, version, versions, def, n, base } = await loadWorkspace(slug, v);
  const host = site.url.replace(/^https?:\/\//, "");
  const tabs =
    def.kind === "dataset"
      ? [
          { slug: "", label: "Overview" },
          { slug: "schema", label: "Schema" },
          { slug: "data", label: "Data" },
          { slug: "playground", label: "Playground" },
          { slug: "versions", label: "Versions" },
          { slug: "activity", label: "Activity" },
          { slug: "settings", label: "Settings" },
        ]
      : [
          { slug: "", label: "Overview" },
          { slug: "configure", label: "Configure" },
          { slug: "playground", label: "Playground" },
          { slug: "versions", label: "Versions" },
          { slug: "activity", label: "Activity" },
          { slug: "settings", label: "Settings" },
        ];

  return (
    <>
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-night text-paper shadow-sm">
              {def.kind === "dataset" ? <Database01 className="size-6" /> : <Tool01 className="size-6" />}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-[24px] leading-tight font-bold tracking-[-0.025em] text-night">{api.name}</h1>
                <StatePill state={version.state} label={`v${n} · ${version.state}`} />
                {api.status === "disabled" && <StatePill state="disabled" />}
              </div>
              <p className="truncate font-mono text-[12.5px] text-slate">
                {host}/v{n}/{slug}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <VersionSwitcher slug={slug} current={n} versions={versions.map((x) => ({ version: x.version, state: x.state }))} />
            {version.state !== "draft" && slug === "menus" && (
              <Button href={`/docs/api/${slug}`} size="md" color="secondary" iconLeading={<BookOpen01 data-icon="leading" />}>
                Docs
              </Button>
            )}
            {version.state === "draft" && <PublishButton slug={slug} version={n} />}
          </div>
        </div>
        <WorkspaceTabs base={base} tabs={tabs} />
      </header>
      {children}
    </>
  );
}
