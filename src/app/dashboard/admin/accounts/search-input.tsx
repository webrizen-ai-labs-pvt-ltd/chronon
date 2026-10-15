"use client";

import { SearchLg } from "@untitledui/icons";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { inputCls } from "@/components/admin/kit";
import { cx } from "@/utils/cx";

/** Filters the account list as you type (debounced), keeping the query in the URL. */
export function AdminSearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const [pending, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const q = value.trim();
      start(() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname));
    }, 250);
    return () => clearTimeout(t);
  }, [value, pathname, router]);

  return (
    <div role="search" className="relative w-full sm:w-[320px]">
      <SearchLg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by email or name"
        aria-label="Search by email or name"
        className={cx(inputCls, "pl-9 pr-9")}
      />
      {pending && <span className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-neutral-300 border-t-ion" aria-label="Searching" />}
    </div>
  );
}
