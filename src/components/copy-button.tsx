"use client";

import { Check, Copy01 } from "@untitledui/icons";
import { useState } from "react";
import { cx } from "@/utils/cx";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border border-line-dark bg-night-2 px-2 py-1 font-mono text-[11px] text-mist-2 transition hover:text-paper",
        className,
      )}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check className="size-3.5 text-ion-soft" /> : <Copy01 className="size-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
