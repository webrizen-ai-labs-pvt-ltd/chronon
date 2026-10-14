import Link from "next/link";
import { ChrononMark } from "@/components/brand";
import { ShaderCanvas } from "@/components/vfx/shader-canvas";
import { PASTEL } from "@/components/vfx/scenes";
import { apiBase, site } from "@/lib/site";

type FooterLink = { label: string; href: string; external?: boolean };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Regional menus", href: "/docs/api/menus" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Fair use", href: "/docs/limits" },
      { label: "Status check", href: "/api/health", external: true },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "Authentication", href: "/docs/authentication" },
      { label: "Errors", href: "/docs/errors" },
      { label: "Contributing", href: "/docs/contributing" },
    ],
  },
  {
    title: "Open source",
    links: [
      { label: "GitHub", href: site.repoUrl, external: true },
      { label: "Report an issue", href: `${site.repoUrl}/issues`, external: true },
      { label: "MIT licence", href: `${site.repoUrl}/blob/main/LICENSE`, external: true },
      { label: "Webrizen SSO", href: "https://accounts.webrizen.com", external: true },
    ],
  },
];

const linkCls = "text-[15px] text-ink-2 no-underline transition hover:text-night";

/** Light footer over grainy pastel dunes (WebGL), shared by every page. */
export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#f6f6fb_40%,#f7c9c4_70%,#7d74e8_100%)] text-night">
      <ShaderCanvas frag={PASTEL} maxDpr={1} scale={0.5} className="-z-10" />
      <div className="container grid gap-10 pt-16 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <ChrononMark size={28} ink="var(--color-night)" />
            <span className="text-[24px] leading-none font-bold tracking-[-0.05em] text-night">chronon</span>
          </Link>
          <p className="max-w-[320px] text-[16px] leading-normal text-ink-2">
            Free utility APIs, built and hosted by {site.org}. No paid plan, no card, no catch.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} className="flex flex-col gap-3" aria-label={col.title}>
            <p className="text-[15px] font-bold text-night">{col.title}</p>
            {col.links.map((l) =>
              l.external ? (
                <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className={linkCls}>
                  {l.label}
                </a>
              ) : (
                <Link key={l.label} href={l.href} className={linkCls}>
                  {l.label}
                </Link>
              ),
            )}
          </nav>
        ))}
      </div>
      <div className="container mt-14 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-night/15 pt-5 font-mono text-[12px] text-ink-2">
          <span>
            © {new Date().getFullYear()} {site.org}
          </span>
          <span>{apiBase.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
      {/* Room for the dunes to breathe. */}
      <div className="h-[260px] sm:h-[320px]" aria-hidden />
    </footer>
  );
}
