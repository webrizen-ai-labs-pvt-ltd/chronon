"use client";

import { useActionState, useState } from "react";
import { createKeyAction, type CreateKeyState } from "./actions";

export function CreateKey({ disabled, disabledReason }: { disabled: boolean; disabledReason?: string }) {
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(createKeyAction, { status: "idle" });
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="key-name">
          Key name
        </label>
        <input
          id="key-name"
          name="name"
          className="input sm:max-w-[320px]"
          placeholder="Name, e.g. recipe-app-prod"
          maxLength={48}
          disabled={disabled || pending}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-photon" disabled={disabled || pending}>
          {pending ? "Creating…" : "Create key"}
        </button>
      </form>
      {disabled && disabledReason && <p className="text-[16px] text-slate">{disabledReason}</p>}
      {state.status === "error" && (
        <p role="alert" className="text-[16px] text-[#b4432b]">
          {state.message}
        </p>
      )}
      {state.status === "created" && (
        <div className="flex flex-col gap-3 rounded-md border border-line-dark bg-night p-5 text-paper" role="status">
          <p className="label text-ion-soft">New key · {state.name}</p>
          <p className="text-[17px] text-mist">Copy it now. For your security we can&apos;t show it again.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 rounded border border-line-dark bg-night-2 px-3 py-2 font-mono text-[13px] break-all text-paper">
              {state.token}
            </code>
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={() => {
                void navigator.clipboard.writeText(state.token);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
