"use client";

import { useFormStatus } from "react-dom";

export function RevokeButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-outline px-3 py-1.5 text-[13px]"
      onClick={(e) => {
        if (!confirm(`Revoke "${name}"? Apps using it will stop working within a minute.`)) e.preventDefault();
      }}
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
