import { DocPager, DocsSidebar, MobileDocsNav } from "@/components/docs";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: { default: "Documentation", template: "%s · Chronon docs" },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader tag="docs" className="sticky top-0 z-30" />
      <MobileDocsNav />
      <div className="mx-auto grid max-w-[1240px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-[73px] hidden h-[calc(100dvh-73px)] overflow-y-auto border-r border-line-light py-10 pr-6 pl-[22px] lg:block">
          <DocsSidebar />
        </aside>
        <main className="min-w-0 px-4 py-10 sm:px-10 lg:px-16 lg:py-14">
          <div className="mx-auto max-w-[760px]">
            <article className="prose">{children}</article>
            <DocPager />
          </div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
