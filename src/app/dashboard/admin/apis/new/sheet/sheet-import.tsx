"use client";

import { ArrowRight, CheckCircle, Database01, Play, XCircle } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { navigate } from "@/components/admin/nav-progress";
import { Alert, PageHeader } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import { buildFromPlan, importOrder, planWorkbook, type Plan, type RawSheet } from "@/lib/builder/infer";
import { FileReadError, nameFromFile, readWorkbook } from "@/lib/builder/read-file";
import type { RecordInput } from "@/lib/builder/records";
import { slugify } from "@/lib/builder/words";
import { cx } from "@/utils/cx";
import { abandonImportAction, createFromSheetAction, importRecordsAction } from "../../actions";
import { ReviewStep, type Meta } from "./review-step";
import { UploadStep } from "./upload-step";

type Progress = { label: string; done: number; total: number; state: "waiting" | "running" | "done" | "error" };

/** Splits records into batches under ~1.5 MB so each server request stays well inside Vercel's body limit. */
function batches(rows: RecordInput[], maxBytes = 1_500_000, maxRows = 2000) {
  const out: RecordInput[][] = [];
  let cur: RecordInput[] = [];
  let size = 0;
  for (const r of rows) {
    const n = JSON.stringify(r).length;
    if (cur.length && (size + n > maxBytes || cur.length >= maxRows)) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(r);
    size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** "From a spreadsheet": upload → review every guess → create a draft API with its data. */
export function SheetImport({ host }: { host: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "review" | "create">("upload");
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<RawSheet[]>([]);
  const [plan, setPlan] = useState<Plan>({ sheets: [] });
  const [meta, setMeta] = useState<Meta>({ name: "", slug: "", summary: "" });
  const [progress, setProgress] = useState<Progress[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const build = useMemo(() => buildFromPlan(plan, sheets), [plan, sheets]);

  async function onFile(file: File) {
    setReading(true);
    setReadError(null);
    try {
      const wb = await readWorkbook(file);
      const p = planWorkbook(wb);
      if (!p.sheets.length) throw new FileReadError("That file doesn't have any data.");
      const name = nameFromFile(file.name);
      setSheets(wb);
      setPlan(p);
      setFileName(file.name);
      setMeta({ name, slug: slugify(name, 40), summary: "" });
      setStep("review");
    } catch (err) {
      setReadError(err instanceof FileReadError ? err.message : "Couldn't read that file.");
    }
    setReading(false);
  }

  async function create() {
    if (!build.definition) return;
    const order = importOrder(build.definition);
    const names = new Map(build.definition.collections.map((c) => [c.slug, c.name]));
    const steps: Progress[] = [
      { label: "Create the API", done: 0, total: 1, state: "running" },
      ...order.map((slug) => ({ label: `Import ${names.get(slug)}`, done: 0, total: build.data[slug]?.length ?? 0, state: "waiting" as const })),
    ];
    setProgress(steps);
    setCreateError(null);
    setStep("create");
    const set = (i: number, patch: Partial<Progress>) => setProgress((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

    const res = await createFromSheetAction({ slug: meta.slug, name: meta.name, summary: meta.summary, definition: build.definition });
    if (!res.ok) {
      set(0, { state: "error" });
      setCreateError(res.error);
      return;
    }
    const slug = res.value;
    setCreated(slug);
    set(0, { state: "done", done: 1 });

    for (const [k, collection] of order.entries()) {
      const i = k + 1;
      set(i, { state: "running" });
      let done = 0;
      for (const chunk of batches(build.data[collection] ?? [])) {
        const r = await importRecordsAction(slug, 1, collection, chunk, "upsert");
        if (!r.ok) {
          set(i, { state: "error" });
          const first = "rows" in r && r.rows?.[0];
          setCreateError(first ? `${r.error} First: ${collection}/${first.slug}: ${Object.values(first.errors)[0]}` : r.error);
          return;
        }
        done += chunk.length;
        set(i, { done });
      }
      set(i, { state: "done" });
    }
    setFinished(true);
    router.refresh();
  }

  if (step === "upload") {
    return (
      <>
        <PageHeader title="New API from a spreadsheet" description="Upload your data, check what Chronon guessed, and get a working API in a minute." />
        <UploadStep onFile={onFile} busy={reading} error={readError} />
      </>
    );
  }

  if (step === "review") {
    return (
      <>
        <PageHeader title="Review your data" description="Every sheet becomes a collection and every column a field. Adjust anything that looks off; the preview updates as you go." />
        <ReviewStep
          fileName={fileName}
          sheets={sheets}
          plan={plan}
          setPlan={setPlan}
          meta={meta}
          setMeta={setMeta}
          build={build}
          host={host}
          onBack={() => setStep("upload")}
          onCreate={create}
        />
      </>
    );
  }

  const base = created ? `/dashboard/admin/apis/${created}/v1` : null;
  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col gap-6 py-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className={cx("grid size-16 place-items-center rounded-2xl shadow-lg", finished ? "bg-[#22a05a] text-white" : createError ? "bg-[#a12b2b] text-white" : "bg-night text-paper")}>
          {finished ? <CheckCircle className="size-8" /> : createError ? <XCircle className="size-8" /> : <Database01 className="size-8 animate-pulse" />}
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-bold tracking-[-0.025em] text-night">{finished ? `${meta.name} is ready` : createError ? "The import stopped" : `Building ${meta.name}…`}</h1>
          <p className="text-[14.5px] text-slate">
            {finished
              ? "It's a private draft. Try it in the playground, then publish when you're happy."
              : createError
                ? "Nothing is public. Fix the file and try again, or open the draft to finish by hand."
                : "Creating the schema and importing your records. Keep this tab open."}
          </p>
        </div>
      </div>

      <ol className="flex flex-col divide-y divide-neutral-200/70 overflow-hidden rounded-xl border border-neutral-200 bg-card">
        {progress.map((p) => (
          <li key={p.label} className="flex items-center gap-3 px-5 py-3.5">
            <span className="grid size-6 shrink-0 place-items-center">
              {p.state === "done" ? (
                <CheckCircle className="size-5 text-[#22a05a]" />
              ) : p.state === "error" ? (
                <XCircle className="size-5 text-[#a12b2b]" />
              ) : p.state === "running" ? (
                <span className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-ion" />
              ) : (
                <span className="size-3 rounded-full border-2 border-neutral-300" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-center justify-between gap-3 text-[14px]">
                <span className={cx("font-bold", p.state === "waiting" ? "text-slate" : "text-night")}>{p.label}</span>
                {p.total > 1 && (
                  <span className="font-mono text-[12px] text-slate tabular-nums">
                    {p.done.toLocaleString("en")} / {p.total.toLocaleString("en")}
                  </span>
                )}
              </span>
              {p.total > 1 && (
                <span className="h-1 overflow-hidden rounded-full bg-neutral-100">
                  <span className={cx("block h-full rounded-full transition-[width] duration-300", p.state === "error" ? "bg-[#d64545]" : "bg-ion")} style={{ width: `${(p.done / p.total) * 100}%` }} />
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {createError && <Alert tone="error">{createError}</Alert>}

      <div className="flex flex-wrap justify-center gap-2">
        {finished && base && (
          <>
            <Button size="md" iconLeading={<Play data-icon="leading" />} onPress={() => navigate(router, `${base}/playground`)}>
              Try it in the playground
            </Button>
            <Button size="md" color="secondary" iconTrailing={<ArrowRight data-icon="trailing" />} onPress={() => navigate(router, base)}>
              Open the API
            </Button>
          </>
        )}
        {createError && (
          <>
            <Button
              size="md"
              color="secondary"
              onPress={async () => {
                if (created) await abandonImportAction(created);
                setCreated(null);
                setStep("review");
              }}
            >
              {created ? "Discard the draft and go back" : "Back to review"}
            </Button>
            {created && (
              <Button size="md" color="tertiary" onPress={() => navigate(router, `${base}/data`)}>
                Open the draft
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
