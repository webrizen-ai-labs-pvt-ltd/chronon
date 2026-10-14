import Link from "next/link";
import { Logo } from "@/components/brand";
import { Button } from "@/components/base/buttons/button";
import { site } from "@/lib/site";
import { cx } from "@/utils/cx";

const nav = [
  { href: "/docs", label: "Guides" },
  { href: "/docs/api/menus", label: "API reference" },
  { href: "/docs/limits", label: "Fair use" },
  { href: site.repoUrl, label: "GitHub", external: true },
];

/**
 * Night bar from the brand reference: lockup · nav · CTA. Its inner edges line
 * up with the page rails so the lattice runs unbroken from top to bottom.
 * `primary` puts the Photon CTA here; pass false when the page already has one.
 */
export function SiteHeader({
  tag,
  right,
  className,
}: {
  tag?: string;
  primary?: boolean;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("dark-mode sticky top-0 z-40 border-b border-white/8 bg-night/95 text-paper backdrop-blur-xl", className)}>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-[22px]">
        <Link href="/" aria-label="Chronon home" className="no-underline">
          <Logo tag={tag} />
        </Link>
        <nav className="ml-auto flex items-center gap-x-6 text-[15px] whitespace-nowrap text-mist max-md:hidden">
          {nav.map((item) =>
            item.external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="no-underline transition hover:text-paper">
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className="no-underline transition hover:text-paper">
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="max-md:ml-auto">
          {right ?? (
            <Button href="/dashboard" size="sm" className="rounded-full">
              Get API key
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
