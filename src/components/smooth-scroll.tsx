"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Fluid, inertial page scrolling (Lenis). It drives the native scroll position,
 * so sticky elements, scroll listeners and IntersectionObservers keep working.
 * Honours prefers-reduced-motion; inner scroll areas can opt out with
 * `data-lenis-prevent`.
 */
export function SmoothScroll() {
  const lenis = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const instance = new Lenis({
      autoRaf: true,
      // Responsive but silky: high enough to track the wheel, low enough to glide.
      lerp: 0.12,
      wheelMultiplier: 1,
      // Touch keeps the platform's native momentum (smoothing it feels laggy on phones).
      syncTouch: false,
      anchors: { offset: -16 },
      respectReducedMotion: true,
    });
    lenis.current = instance;
    return () => {
      instance.destroy();
      lenis.current = null;
    };
  }, []);

  // New page: start at the top without easing through the old one.
  useEffect(() => {
    lenis.current?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return null;
}
