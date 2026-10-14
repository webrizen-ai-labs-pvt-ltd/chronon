"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Drives the page's light effects with CSS variables, no re-renders:
 *  --px / --py, --nx/--ny  pointer position (px / 0..1) inside a hovered [data-prism] or [data-track] surface
 *  [data-shown]         set on [data-reveal] elements once they scroll into view
 */
export function Ambient() {
  const pathname = usePathname();

  useEffect(() => {
    // Pointer effects only; nothing is written on scroll, so scrolling never
    // restyles the page. Writes are batched to one per animation frame.
    let pending: PointerEvent | null = null;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const e = pending;
      if (!e) return;
      const surface = (e.target as Element | null)?.closest?.<HTMLElement>("[data-prism], [data-track]");
      if (!surface) return;
      const r = surface.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      surface.style.setProperty("--px", `${x}px`);
      surface.style.setProperty("--py", `${y}px`);
      surface.style.setProperty("--prism-angle", `${Math.round((x / r.width) * 120)}deg`);
      surface.style.setProperty("--nx", (x / r.width).toFixed(3));
      surface.style.setProperty("--ny", (y / r.height).toFixed(3));
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pending = e;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("pointermove", onPointer);
    };
  }, []);

  // Re-scan for reveal targets on every route change.
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-shown])");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.setAttribute("data-shown", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
