"use client";

import { Activity, ArrowUpRight, BookOpen01, Database01, Grid01, LogOut01, Menu02, Plus, Users01, X } from "@untitledui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense, useState, type ReactNode } from "react";
import { ChrononMark } from "@/components/brand";
import { cx } from "@/utils/cx";
import { NavProgress } from "./nav-progress";

const groups = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard/admin", label: "Overview", icon: Grid01, exact: true },
      { href: "/dashboard/admin/apis", label: "APIs", icon: Database01 },
      { href: "/dashboard/admin/activity", label: "Activity", icon: Activity },
    ],
  },
  { label: "People", items: [{ href: "/dashboard/admin/accounts", label: "Accounts", icon: Users01 }] },
];

const tabLabels: Record<string, string> = {
  apis: "APIs",
  accounts: "Accounts",
  activity: "Activity",
  new: "New API",
  sheet: "From a spreadsheet",
  schema: "Schema",
  data: "Data",
  configure: "Configure",
  playground: "Playground",
  versions: "Versions",
  settings: "Settings",
};

/** Breadcrumbs from the URL: /dashboard/admin/apis/menus/v1/data → Admin / APIs / menus / v1 / Data. */
function crumbs(pathname: string) {
  const parts = pathname.replace(/^\/dashboard\/admin\/?/, "").split("/").filter(Boolean);
  const out = [{ href: "/dashboard/admin", label: "Admin" }];
  let href = "/dashboard/admin";
  parts.forEach((p, i) => {
    href += `/${p}`;
    const isApiSlug = parts[0] === "apis" && i === 1 && p !== "new";
    out.push({ href, label: tabLabels[p] ?? (isApiSlug ? p : p) });
  });
  return out;
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-1">
          <p className="px-2.5 pb-1 font-mono text-[10.5px] tracking-[0.06em] text-mist-2/80 uppercase">{g.label}</p>
          {g.items.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] no-underline transition-colors",
                  active ? "bg-white/[0.07] text-paper" : "text-mist hover:bg-white/[0.04] hover:text-paper",
                )}
              >
                {active && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-photon" aria-hidden />}
                <Icon className={cx("size-[18px] shrink-0", active ? "text-ion-soft" : "text-mist-2 group-hover:text-mist")} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ pathname, user, onNavigate }: { pathname: string; user: { name: string | null; email: string }; onNavigate?: () => void }) {
  const initials = (user.name ?? user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  return (
    <div className="flex h-full flex-col bg-night text-mist">
      <div className="flex h-16 items-center gap-2.5 border-b border-line-dark px-5">
        <Link href="/dashboard/admin" onClick={onNavigate} className="flex items-center gap-2.5 no-underline">
          <ChrononMark size={26} ink="var(--color-paper)" />
          <span className="text-[19px] leading-none font-bold tracking-[-0.04em] text-paper">chronon</span>
        </Link>
        <span className="rounded border border-line-dark px-1.5 py-0.5 font-mono text-[10.5px] text-mist-2">admin</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5" data-lenis-prevent>
        <Link
          href="/dashboard/admin/apis/new"
          onClick={onNavigate}
          className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-line-dark bg-night-2 px-3 py-2 text-[14px] font-bold text-paper no-underline transition hover:border-mist-2/40"
        >
          <Plus className="size-4" /> New API
        </Link>
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </div>

      <div className="flex flex-col gap-1 border-t border-line-dark px-3 py-3">
        <Link href="/docs" className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] text-mist no-underline hover:bg-white/[0.04] hover:text-paper">
          <BookOpen01 className="size-[18px] text-mist-2" /> Docs
        </Link>
        <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] text-mist no-underline hover:bg-white/[0.04] hover:text-paper">
          <ArrowUpRight className="size-[18px] text-mist-2" /> My API keys
        </Link>
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-night-2 px-2.5 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ion font-mono text-[11px] text-paper">{initials || "A"}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13.5px] text-paper">{user.name ?? "Admin"}</span>
            <span className="truncate text-[12px] text-mist-2">{user.email}</span>
          </span>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler, needs a full navigation */}
          <a href="/api/auth/webrizen/logout" aria-label="Sign out" title="Sign out" className="grid size-8 shrink-0 place-items-center rounded-md text-mist-2 transition hover:bg-white/[0.06] hover:text-paper">
            <LogOut01 className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

/** The admin console frame: brand sidebar, top bar with breadcrumbs, scrollable content. */
export function AdminShell({ user, children }: { user: { name: string | null; email: string }; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trail = crumbs(pathname);

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <Suspense>
        <NavProgress />
      </Suspense>
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar pathname={pathname} user={user} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-night/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-2xl">
            <Sidebar pathname={pathname} user={user} onNavigate={() => setOpen(false)} />
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute top-4 -right-12 grid size-9 place-items-center rounded-full bg-night text-paper">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-paper/90 px-4 backdrop-blur-md sm:px-6 lg:px-10">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="-ml-1 grid size-9 place-items-center rounded-lg text-night hover:bg-neutral-100 lg:hidden">
            <Menu02 className="size-5" />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[14px]">
            {trail.map((c, i) => (
              <Fragment key={c.href}>
                {i > 0 && (
                  <span className="text-mist" aria-hidden>
                    /
                  </span>
                )}
                {i === trail.length - 1 ? (
                  <span aria-current="page" className="truncate font-bold text-night">
                    {c.label}
                  </span>
                ) : (
                  <Link href={c.href} className={cx("truncate text-slate no-underline transition hover:text-night", i > 0 && i < trail.length - 2 && "max-sm:hidden")}>
                    {c.label}
                  </Link>
                )}
              </Fragment>
            ))}
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-[1360px] min-w-0 flex-1 flex-col gap-7 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
