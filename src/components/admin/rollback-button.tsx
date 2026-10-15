"use client";

import { ReverseLeft } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { rollbackAction } from "@/app/dashboard/admin/apis/actions";
import { ConfirmButton } from "./interactive";

export function RollbackButton({ id, slug }: { id: number; slug: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Roll back"
      size="xs"
      iconLeading={<ReverseLeft data-icon="leading" />}
      title="Restore the schema from before this change?"
      body={<p>The schema goes back to how it was just before this change. Live versions only accept the rollback if it&apos;s additive.</p>}
      confirmLabel="Roll back"
      onConfirm={async () => {
        const res = await rollbackAction(id, slug);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
