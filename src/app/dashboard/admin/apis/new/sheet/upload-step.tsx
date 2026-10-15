"use client";

import { File06, Upload01 } from "@untitledui/icons";
import { useRef, useState } from "react";
import { Alert } from "@/components/admin/kit";
import { ACCEPT } from "@/lib/builder/read-file";
import { cx } from "@/utils/cx";

/** Drop zone for the spreadsheet. Reading happens in the parent. */
export function UploadStep({ onFile, busy, error }: { onFile: (f: File) => void; busy: boolean; error: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a spreadsheet"
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f && !busy) onFile(f);
        }}
        className={cx(
          "group flex cursor-pointer flex-col items-center gap-5 rounded-2xl border-2 border-dashed bg-card px-6 py-16 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          drag ? "scale-[1.01] border-ion bg-[#f6f3fe]" : "border-neutral-300 hover:border-ion/60 hover:bg-[#fbfaff]",
          busy && "pointer-events-none",
        )}
      >
        <span className={cx("grid size-16 place-items-center rounded-2xl bg-night text-paper shadow-lg transition", drag ? "scale-110" : "group-hover:-translate-y-0.5")}>
          {busy ? <span className="size-6 animate-spin rounded-full border-[3px] border-white/25 border-t-paper" /> : <Upload01 className="size-7" />}
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-[19px] font-bold text-night">{busy ? "Reading your file…" : drag ? "Drop it here" : "Drop a spreadsheet, or click to choose"}</p>
          <p className="text-[14px] text-slate">Excel (.xlsx), CSV or JSON, up to 15 MB. Every sheet becomes a collection.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Row 1 is the header", "Column titles become field names. Title rows above it are skipped."],
          ["One sheet per collection", "Columns that name rows of another sheet become links."],
          ["Nothing goes live yet", "You review every guess, then get a private draft to test."],
        ].map(([title, text]) => (
          <div key={title} className="flex gap-3 rounded-xl border border-neutral-200 bg-card p-4">
            <File06 className="mt-0.5 size-5 shrink-0 text-ion" />
            <div className="flex flex-col gap-0.5">
              <p className="text-[14px] font-bold text-night">{title}</p>
              <p className="text-[13px] leading-snug text-slate">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
