"use client";

import { Key01, Plus } from "@untitledui/icons";
import { useActionState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { CopyButton } from "@/components/copy-button";
import { createKeyAction, type CreateKeyState } from "./actions";

export function CreateKey({ disabled, disabledReason }: { disabled: boolean; disabledReason?: string }) {
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(createKeyAction, { status: "idle" });

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Input
          name="name"
          aria-label="Key name"
          placeholder="Name, e.g. recipe-app-prod"
          icon={Key01}
          maxLength={48}
          isDisabled={disabled || pending}
          autoComplete="off"
          className="sm:w-[340px]"
        />
        <Button type="submit" color="primary" size="md" iconLeading={Plus} isDisabled={disabled} isLoading={pending} showTextWhileLoading>
          Create key
        </Button>
      </form>
      {disabled && disabledReason && <p className="text-[16px] text-slate">{disabledReason}</p>}
      {state.status === "error" && (
        <p role="alert" className="text-[16px] text-[#b4432b]">
          {state.message}
        </p>
      )}
      {state.status === "created" && (
        <div data-prism className="dark-mode flex flex-col gap-3 rounded-xl border border-line-dark bg-night p-5 text-paper" role="status">
          <p className="label text-ion-soft">New key · {state.name}</p>
          <p className="text-[17px] text-mist">Copy it now. We only store a hash, so it can&apos;t be shown again.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 rounded-lg border border-line-dark bg-night-2 px-3 py-2.5 font-mono text-[13px] break-all text-paper">
              {state.token}
            </code>
            <CopyButton text={state.token} label="Copy key" className="self-start px-3 py-2 text-[12px] sm:self-auto" />
          </div>
        </div>
      )}
    </div>
  );
}
