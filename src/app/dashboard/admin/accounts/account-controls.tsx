"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmButton } from "@/components/admin/interactive";
import { inputCls, selectCls } from "@/components/admin/kit";
import { cx } from "@/utils/cx";
import { setBannedAction, setTierAction } from "./actions";

/** Tier picker that saves on change, with inline progress and errors. */
export function TierSelect({ userId, tier, tiers }: { userId: string; tier: string; tiers: { id: string; label: string }[] }) {
  const router = useRouter();
  const [value, setValue] = useState(tier);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Tier"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setError(null);
          start(async () => {
            const res = await setTierAction(userId, next);
            if (!res.ok) {
              setValue(prev);
              setError(res.error);
            } else router.refresh();
          });
        }}
        className={cx(selectCls, "w-[132px] py-1.5")}
      >
        {tiers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-ion" aria-label="Saving" />}
      {error && <span className="text-[12.5px] text-[#a12b2b]">{error}</span>}
    </div>
  );
}

export function SuspendButton({ userId, email, banned }: { userId: string; email: string; banned: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  if (banned) {
    return (
      <ConfirmButton
        label="Reinstate"
        size="xs"
        title={`Reinstate ${email}?`}
        body={<p>Their keys start working again within a minute.</p>}
        confirmLabel="Reinstate"
        onConfirm={async () => {
          const res = await setBannedAction(userId, false, "");
          if (res.ok) router.refresh();
          return res;
        }}
      />
    );
  }
  return (
    <ConfirmButton
      label="Suspend"
      size="xs"
      tone="danger"
      title={`Suspend ${email}?`}
      body={
        <div className="flex flex-col gap-3">
          <p>Every key on this account stops working within a minute. They see the reason in their dashboard.</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-night">Reason</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Automated scraping beyond fair use" className={inputCls} />
          </label>
        </div>
      }
      confirmLabel="Suspend account"
      onConfirm={async () => {
        const res = await setBannedAction(userId, true, reason);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
