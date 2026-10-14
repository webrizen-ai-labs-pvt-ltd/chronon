"use client";

import { SearchLg } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";

/** Search field for the admin list (a client component so it can pass the icon). */
export function AdminSearchInput({ defaultValue }: { defaultValue: string }) {
  return (
    <Input
      name="q"
      aria-label="Search by email or name"
      defaultValue={defaultValue}
      placeholder="Search by email or name"
      icon={SearchLg}
      className="w-full max-w-[360px]"
    />
  );
}
