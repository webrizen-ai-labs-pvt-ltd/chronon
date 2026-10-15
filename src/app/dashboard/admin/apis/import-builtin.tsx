"use client";

import { navigate } from "@/components/admin/nav-progress";
import { Download01 } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/interactive";
import { importBuiltinAction } from "./actions";

export function ImportBuiltin() {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Import to builder"
      iconLeading={<Download01 data-icon="leading" />}
      title="Import Regional menus?"
      body={
        <p>
          Copies the menus schema and all of its records into the database as a published v1. Responses stay identical; from then on you edit the data
          here instead of in the repository&apos;s JSON files.
        </p>
      }
      confirmLabel="Import"
      onConfirm={async () => {
        const res = await importBuiltinAction("menus");
        if (res.ok) navigate(router, "/dashboard/admin/apis/menus");
        return res;
      }}
    />
  );
}
