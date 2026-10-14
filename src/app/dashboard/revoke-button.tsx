"use client";

import { Trash01 } from "@untitledui/icons";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/base/buttons/button";
import { revokeKeyAction } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" color="secondary-destructive" size="sm" iconLeading={Trash01} isLoading={pending} showTextWhileLoading>
      Revoke
    </Button>
  );
}

/** Revoke form with a confirmation step. */
export function RevokeForm({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={revokeKeyAction}
      onSubmit={(e) => {
        if (!confirm(`Revoke "${name}"? Apps using it will stop working within a minute.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Submit />
    </form>
  );
}
