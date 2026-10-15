"use client";

import { useEffect } from "react";

/**
 * Starts the OAuth flow with a real browser navigation. Effects only run when
 * the page is actually shown, so prefetches and RSC requests never start a
 * login (each start replaces the pending-login cookie and breaks the one in flight).
 */
export function ContinueToWebrizen({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return null;
}
