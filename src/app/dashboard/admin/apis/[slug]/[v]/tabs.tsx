"use client";

import { navigate } from "@/components/admin/nav-progress";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cx } from "@/utils/cx";

export function WorkspaceTabs({ base, tabs }: { base: string; tabs: { slug: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="API sections" className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-neutral-200)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = t.slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
        return (
          <Link
            key={t.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative shrink-0 border-b-2 px-3 pt-1 pb-3 text-[14px] font-bold whitespace-nowrap no-underline transition",
              active ? "border-night text-night" : "border-transparent text-slate hover:text-night",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Switches version while staying on the same tab. */
export function VersionSwitcher({ slug, current, versions }: { slug: string; current: number; versions: { version: number; state: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  if (versions.length < 2) return null;
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Version</span>
      <select
        value={current}
        onChange={(e) => {
          const prefix = `/dashboard/admin/apis/${slug}/v${current}`;
          navigate(router, pathname.replace(prefix, `/dashboard/admin/apis/${slug}/v${e.target.value}`));
        }}
        className="appearance-none rounded-lg bg-card py-2 pr-8 pl-3 font-mono text-[13px] text-night shadow-xs ring-1 ring-neutral-200 ring-inset outline-none focus:ring-2 focus:ring-focus-ring"
      >
        {versions.map((v) => (
          <option key={v.version} value={v.version}>
            v{v.version} · {v.state}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 size-3.5 text-slate" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
