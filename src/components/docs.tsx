"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { allDocPages, docsNav } from "@/lib/docs/nav";

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-7" aria-label="Documentation">
      {docsNav.map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          <p className="label text-slate">{section.title}</p>
          <ul className="flex flex-col">
            {section.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-ml-3 block border-l-2 py-1 pl-3 text-[16px] no-underline",
                      active ? "border-photon text-night" : "border-transparent text-ink-2 hover:text-night",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Compact select-style nav for small screens. */
export function MobileDocsNav() {
  const pathname = usePathname();
  const current = allDocPages.find((p) => p.href === pathname);
  return (
    <details className="group border-b border-line-light bg-paper lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[16px]">
        <span>{current?.title ?? "Documentation"}</span>
        <span className="label text-slate group-open:hidden">Menu</span>
        <span className="label hidden text-slate group-open:inline">Close</span>
      </summary>
      <div className="px-4 pt-2 pb-6">
        <DocsSidebar />
      </div>
    </details>
  );
}

export function DocPager() {
  const pathname = usePathname();
  const i = allDocPages.findIndex((p) => p.href === pathname);
  if (i === -1) return null;
  const prev = allDocPages[i - 1];
  const next = allDocPages[i + 1];
  return (
    <nav className="mt-16 grid gap-3 border-t border-line-light pt-8 sm:grid-cols-2" aria-label="Pagination">
      {prev ? (
        <Link href={prev.href} className="rounded-md border border-line-light bg-card p-4 no-underline hover:border-night">
          <span className="label block text-slate">Previous</span>
          <span className="text-[18px] text-night">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          href={next.href}
          className="rounded-md border border-line-light bg-card p-4 text-right no-underline hover:border-night"
        >
          <span className="label block text-slate">Next</span>
          <span className="text-[18px] text-night">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}

/** Code block with a copy button. */
export function Pre(props: ComponentProps<"pre">) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre ref={ref} {...props} />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(ref.current?.innerText ?? "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="label absolute top-2.5 right-2.5 rounded border border-line-dark bg-night-2 px-2 py-1 text-[11px] text-mist-2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-paper focus:opacity-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
