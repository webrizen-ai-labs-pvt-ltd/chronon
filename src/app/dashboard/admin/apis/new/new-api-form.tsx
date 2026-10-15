"use client";

import { navigate } from "@/components/admin/nav-progress";
import { AlignLeft, ArrowRight, Check, Clock, Database01, Fingerprint01, Hash01, Link01, QrCode01, Scales01, Tool01, Upload01 } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { useState, type FC, type SVGProps } from "react";
import { Field } from "@/components/admin/interactive";
import { Alert, inputCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { createApiAction } from "../actions";

const blockIcons: Record<string, FC<SVGProps<SVGSVGElement>>> = {
  qr: QrCode01,
  slugify: Link01,
  "text-stats": AlignLeft,
  units: Scales01,
  timezones: Clock,
  ids: Fingerprint01,
  hash: Hash01,
};

function toSlug(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function Choice({ selected, onSelect, icon: Icon, title, children }: { selected: boolean; onSelect: () => void; icon: FC<SVGProps<SVGSVGElement>>; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "relative flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5 text-left shadow-xs transition outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        selected ? "border-ion ring-1 ring-ion" : "border-neutral-200 hover:border-mist-2",
      )}
    >
      <span className={cx("grid size-10 place-items-center rounded-lg border", selected ? "border-ion/30 bg-[#f3f0fd] text-ion" : "border-neutral-200 bg-paper text-slate")}>
        <Icon className="size-5" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-[15px] font-bold text-night">{title}</span>
        <span className="text-[13.5px] leading-snug text-slate">{children}</span>
      </span>
      {selected && (
        <span className="absolute top-4 right-4 grid size-5 place-items-center rounded-full bg-ion text-white">
          <Check className="size-3.5" />
        </span>
      )}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-night font-mono text-[12px] text-paper">{n}</span>
        <h2 className="pt-0.5 text-[15px] font-bold text-night">{title}</h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function NewApiForm({ blocks }: { blocks: { id: string; name: string; summary: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"dataset" | "block">("dataset");
  const [block, setBlock] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : toSlug(name);
  const canSubmit = name.trim() && effectiveSlug && (kind === "dataset" || block);

  return (
    <form
      className="flex flex-col gap-10"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        const res = await createApiAction({ slug: effectiveSlug, name, summary, kind, block: block ?? undefined });
        if (res.ok) navigate(router, `/dashboard/admin/apis/${res.value}/v1/${kind === "dataset" ? "schema" : "configure"}`);
        else {
          setError(res.error);
          setBusy(false);
        }
      }}
    >
      <Step n={1} title="Type">
        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate(router, "/dashboard/admin/apis/new/sheet")}
            className="group relative flex min-w-0 flex-col gap-3 rounded-xl border border-night bg-night p-5 text-left text-paper shadow-md transition outline-none hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <span className="absolute top-4 right-4 rounded-full bg-photon px-2 py-0.5 text-[11px] font-bold text-night">Fastest</span>
            <span className="grid size-10 place-items-center rounded-lg border border-line-dark bg-night-2 text-ion-soft">
              <Upload01 className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[15px] font-bold">From a spreadsheet</span>
              <span className="text-[13.5px] leading-snug text-mist">Upload Excel, CSV or JSON. Chronon reads the columns, types and links between sheets, and builds the API with your data.</span>
            </span>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-bold text-ion-soft">
              Upload a file <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          </button>
          <Choice selected={kind === "dataset"} onSelect={() => setKind("dataset")} icon={Database01} title="Dataset from scratch">
            Design collections and fields yourself, then add records by hand or import them. Chronon serves list, detail, search, filters and random endpoints.
          </Choice>
          <Choice selected={kind === "block"} onSelect={() => setKind("block")} icon={Tool01} title="Utility block">
            A ready-made tool (QR codes, hashing, unit conversion…). Name it, tune its limits, publish.
          </Choice>
        </div>
      </Step>

      {kind === "block" && (
        <Step n={2} title="Block">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {blocks.map((b) => (
              <Choice key={b.id} selected={block === b.id} onSelect={() => {
                setBlock(b.id);
                if (!name) setName(b.name);
              }} icon={blockIcons[b.id] ?? Tool01} title={b.name}>
                {b.summary}
              </Choice>
            ))}
          </div>
        </Step>
      )}

      <Step n={kind === "block" ? 3 : 2} title="Details">
        <div className="grid max-w-[640px] gap-5 rounded-xl border border-neutral-200 bg-card p-5 shadow-xs">
          <Field label="Name" required htmlFor="api-name" hint="Shown in docs and the dashboard.">
            <input id="api-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. World capitals" className={inputCls} autoComplete="off" />
          </Field>
          <Field label="Slug" required htmlFor="api-slug" hint="Lowercase letters, numbers and hyphens. Can't be changed later.">
            <div className="flex items-stretch overflow-hidden rounded-lg shadow-xs ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand">
              <span className="flex items-center border-r border-neutral-200 bg-paper px-3 font-mono text-[13px] text-slate">/v1/</span>
              <input
                id="api-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                maxLength={40}
                className="min-w-0 flex-1 bg-primary px-3 py-2 font-mono text-[13.5px] text-primary outline-none"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </Field>
          <Field label="Summary" htmlFor="api-summary" hint="One sentence for the docs and the API index.">
            <textarea id="api-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={200} rows={2} className={cx(inputCls, "resize-none")} />
          </Field>
        </div>
      </Step>

      <div className="flex flex-col gap-4 border-t border-neutral-200 pt-6 md:pl-[232px]">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" size="md" isDisabled={!canSubmit} isLoading={busy}>
            Create draft
          </Button>
          <Button href="/dashboard/admin/apis" size="md" color="secondary">
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
