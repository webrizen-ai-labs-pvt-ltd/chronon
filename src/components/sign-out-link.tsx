"use client";

import { LogOut01 } from "@untitledui/icons";
import { styles } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";

/**
 * Sign-out goes to a route handler, which needs a full page load, so this is a
 * plain <a> wearing Untitled UI's secondary button styles (a React Aria link
 * would try to navigate client-side).
 */
export function SignOutLink() {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler, needs a full navigation
    <a
      href="/api/auth/webrizen/logout"
      className={cx(styles.common.root, styles.sizes.sm.root, styles.colors.secondary.root, "no-underline")}
    >
      <LogOut01 data-icon="leading" />
      <span className="px-0.5">Sign out</span>
    </a>
  );
}
