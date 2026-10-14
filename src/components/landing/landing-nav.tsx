import Link from "next/link";
import { ChrononMark } from "@/components/brand";
import { Button } from "@/components/base/buttons/button";
import { site } from "@/lib/site";

const left = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/api/menus", label: "API" },
  { href: "#explore", label: "Explore" },
];
const right = [
  { href: "/docs/limits", label: "Fair use" },
  { href: site.repoUrl, label: "GitHub", external: true },
];

const linkCls = "caption text-mist/80 no-underline transition hover:text-paper";

/**
 * Overlay navigation for the landing hero: links split around a centred mark,
 * small mono capitals, no bar. Docs and dashboard keep SiteHeader.
 */
export function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <nav className="container flex items-center justify-between gap-6 py-6 md:grid md:grid-cols-[1fr_auto_1fr]" aria-label="Main">
        <div className="flex items-center gap-8 max-md:hidden">
          {left.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls}>
              {l.label}
            </Link>
          ))}
        </div>
        <Link href="/" aria-label="Chronon home" className="flex items-center gap-2.5 no-underline md:justify-self-center">
          <ChrononMark size={30} ink="var(--color-paper)" />
          <span className="text-[22px] leading-none font-bold tracking-[-0.05em] text-paper">chronon</span>
        </Link>
        <div className="flex items-center justify-end gap-8">
          {right.map((l) =>
            l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className={`${linkCls} max-md:hidden`}>
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className={`${linkCls} max-md:hidden`}>
                {l.label}
              </Link>
            ),
          )}
          <Button href="/dashboard" size="sm" className="rounded-full">
            Get API key
          </Button>
        </div>
      </nav>
    </header>
  );
}
