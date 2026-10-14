import Link from "next/link";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

const nav = [
  { href: "/docs", label: "Guides" },
  { href: "/docs/api/menus", label: "API reference" },
  { href: site.repoUrl, label: "GitHub", external: true },
];

/**
 * Night bar from the brand reference: lockup · nav · CTA.
 * `primary` puts the Photon CTA here; pass false when the page already has one.
 */
export function SiteHeader({
  tag,
  primary = true,
  right,
  className,
}: {
  tag?: string;
  primary?: boolean;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-line-dark bg-night text-paper", className)}>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-[22px]">
        <Link href="/" aria-label="Chronon home" className="no-underline">
          <Logo tag={tag} />
        </Link>
        {/* On phones the footer and docs menu carry these links, keeping the bar to one row. */}
        <nav className="ml-auto flex flex-wrap max-sm:hidden items-center gap-x-5 gap-y-2 text-[15px] whitespace-nowrap text-mist">
          {nav.map((item) =>
            item.external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="no-underline hover:text-paper">
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className="no-underline hover:text-paper">
                {item.label}
              </Link>
            ),
          )}
        </nav>
        {right ?? (
          <Link href="/dashboard" className={cn("btn max-sm:ml-auto", primary ? "btn-photon" : "btn-outline-dark")}>
            Get API key
          </Link>
        )}
      </div>
    </header>
  );
}
