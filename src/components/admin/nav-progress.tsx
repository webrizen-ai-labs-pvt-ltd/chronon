"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A thin bar at the top of the console that starts the moment an internal link
 * is clicked and finishes when the new route renders, so navigation never feels
 * unresponsive while a server page loads.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const route = `${pathname}?${search.toString()}`;
  // The route we were on when a navigation started; null when idle.
  const [from, setFrom] = useState<string | null>(null);
  const state = from === null ? "idle" : from === route ? "loading" : "done";

  // Arrival: let the bar finish, then reset.
  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => setFrom(null), 260);
    return () => clearTimeout(t);
  }, [state]);

  // Departure: any same-origin link click (or a form-driven push) starts it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      // Route handlers (sign-out, exports) don't change the page.
      if (url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.endsWith("/export")) return;
      if (url.pathname + url.search === location.pathname + location.search) return;
      setFrom(here());
    };
    const onStart = () => setFrom(here());
    document.addEventListener("click", onClick, true);
    window.addEventListener("chronon:navigate", onStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("chronon:navigate", onStart);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]">
      <div
        className="h-full bg-photon shadow-[0_0_8px_rgba(222,100,73,0.6)]"
        style={{
          width: state === "idle" ? "0%" : state === "loading" ? "80%" : "100%",
          opacity: state === "idle" ? 0 : 1,
          transition:
            state === "loading" ? "width 6s cubic-bezier(0.08, 0.8, 0.2, 1), opacity 0.1s" : state === "done" ? "width 0.2s ease-out, opacity 0.25s 0.15s" : "none",
        }}
      />
    </div>
  );
}

/** The current route, normalised the same way as usePathname + useSearchParams. */
function here() {
  return `${location.pathname}?${new URLSearchParams(location.search).toString()}`;
}

/** Lets code that calls router.push() start the bar too. */
export function startNavProgress() {
  window.dispatchEvent(new Event("chronon:navigate"));
}

/** router.push with the progress bar. */
export function navigate(router: { push: (href: string) => void }, href: string) {
  startNavProgress();
  router.push(href);
}
