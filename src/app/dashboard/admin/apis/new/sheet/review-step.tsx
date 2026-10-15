"use client";

import { AlertTriangle, ArrowLeft, CheckCircle, Link03 } from "@untitledui/icons";
import { useMemo, useState } from "react";
import { Field } from "@/components/admin/interactive";
import { inputCls, selectCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import { Highlight } from "@/components/landing/highlight";
import { SLUG_RE, type FieldType } from "@/lib/builder/definition";
import { handleDataset, prepare } from "@/lib/builder/engine";
import { cellText, clean, linkSheets, planSheet, retype, type BuildResult, type ColumnPlan, type Plan, type RawSheet, type SheetPlan } from "@/lib/builder/infer";
import { cx } from "@/utils/cx";

export type Meta = { name: string; slug: string; summary: string };

const TYPE_LABELS: Record<Exclude<FieldType, "reference">, string> = {
  text: "Text",
  longtext: "Long text",
  integer: "Whole number",
  number: "Number",
  boolean: "Yes / no",
  enum: "Choice",
  list: "List",
  date: "Date",
  url: "Link (URL)",
};

function typeValue(c: ColumnPlan) {
  return c.type === "reference" ? `ref:${c.targetSheet}` : c.type;
}

function Detail({ c }: { c: ColumnPlan }) {
  if (c.type === "enum") return <span>{c.values?.length ?? 0} choices</span>;
  if (c.type === "list") return <span>Split on “{c.separator === "\n" ? "line break" : c.separator}”{c.itemType === "enum" ? `, ${c.values?.length} choices` : ""}</span>;
  if (c.type === "reference")
    return (
      <span className="inline-flex items-center gap-1 text-ion">
        <Link03 className="size-3.5" /> rows of {c.targetSheet}
      </span>
    );
  return null;
}

export function ReviewStep({
  fileName,
  sheets,
  plan,
  setPlan,
  meta,
  setMeta,
  build,
  onBack,
  onCreate,
  host,
}: {
  fileName: string;
  sheets: RawSheet[];
  plan: Plan;
  setPlan: (p: Plan) => void;
  meta: Meta;
  setMeta: (m: Meta) => void;
  build: BuildResult;
  onBack: () => void;
  onCreate: () => void;
  host: string;
}) {
  const [sel, setSel] = useState(0);
  const [showIssues, setShowIssues] = useState(false);
  const p = plan.sheets[Math.min(sel, plan.sheets.length - 1)];
  const raw = sheets.find((s) => s.name === p.name)!;
  const linkable = plan.sheets.filter((x) => x !== p && x.include && x.id.kind !== "row");
  const included = plan.sheets.filter((x) => x.include);
  const bad = build.invalid[p.name] ?? {};
  const slugOk = SLUG_RE.test(meta.slug) && meta.slug.length <= 40;

  const update = (fn: (draft: Plan) => void) => {
    const next = structuredClone(plan);
    fn(next);
    setPlan(next);
  };
  const updateSheet = (fn: (s: SheetPlan) => void) => update((d) => fn(d.sheets[plan.sheets.indexOf(p)]));
  const updateCol = (i: number, fn: (c: ColumnPlan) => ColumnPlan | void) =>
    updateSheet((s) => {
      const res = fn(s.columns[i]);
      if (res) s.columns[i] = res;
    });

  // Live preview: the first record exactly as the API will return it.
  const preview = useMemo(() => {
    if (!build.definition || !p.include) return null;
    const rows = build.data[p.slug] ?? [];
    if (!rows.length) return null;
    const data = Object.fromEntries(Object.entries(build.data).map(([k, list]) => [k, list.map((r) => ({ slug: String(r.slug), data: r.data }))]));
    const res = handleDataset(prepare(build.definition, data), [p.slug, String(rows[0].slug)], new URLSearchParams(), `/v1/${meta.slug}`);
    return { path: `/v1/${meta.slug || "…"}/${p.slug}/${String(rows[0].slug)}`, json: JSON.stringify("body" in res ? res.body : res.error, null, 2) };
  }, [build, p, meta.slug]);

  const headerOptions = raw.rows.slice(0, 10).map((r, i) => {
    const first = r.map(clean).filter((c) => c !== null).slice(0, 3).map(cellText).join(" · ");
    return { i, label: `Row ${i + 1}${first ? `: ${first.slice(0, 40)}` : ""}` };
  });
  const totalBad = Object.values(build.invalid).reduce((n, cols) => n + Object.values(cols).reduce((a, b) => a + b, 0), 0);
  const fieldCount = included.reduce((n, s) => n + s.columns.filter((c) => c.include).length, 0);
  const canCreate = Boolean(build.definition) && slugOk && meta.name.trim().length > 0;

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* API details */}
      <section className="grid gap-4 rounded-xl border border-neutral-200 bg-card p-5 shadow-[0_1px_2px_rgba(15,18,32,0.04)] md:grid-cols-[1fr_1fr_1.4fr]">
        <Field label="API name" required htmlFor="m-name">
          <input id="m-name" value={meta.name} maxLength={60} onChange={(e) => setMeta({ ...meta, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="URL" required htmlFor="m-slug" error={meta.slug && !slugOk ? "Lowercase letters, numbers and hyphens" : undefined}>
          <div className="flex items-stretch overflow-hidden rounded-lg shadow-xs ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand">
            <span className="flex items-center border-r border-neutral-200 bg-paper px-2.5 font-mono text-[12px] text-slate">/v1/</span>
            <input
              id="m-slug"
              value={meta.slug}
              maxLength={40}
              onChange={(e) => setMeta({ ...meta, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
              className="min-w-0 flex-1 bg-primary px-3 py-2 font-mono text-[12.5px] text-primary outline-none"
              spellCheck={false}
            />
          </div>
        </Field>
        <Field label="Summary" htmlFor="m-summary">
          <input id="m-summary" value={meta.summary} maxLength={200} placeholder="One sentence for the docs" onChange={(e) => setMeta({ ...meta, summary: e.target.value })} className={inputCls} />
        </Field>
      </section>

      {/* Sheets */}
      <div className="flex flex-col gap-2">
          <p className="px-1 text-[13px] text-slate">
            {fileName} · {plan.sheets.length} sheet{plan.sheets.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {plan.sheets.map((s, i) => (
              <div
                key={s.name}
                className={cx(
                  "flex min-w-[210px] shrink-0 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition",
                  i === sel ? "border-ion ring-1 ring-ion" : "border-neutral-200 hover:border-neutral-300",
                  !s.include && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={s.include}
                  aria-label={`Include ${s.name}`}
                  onChange={() => update((d) => void (d.sheets[i].include = !d.sheets[i].include))}
                  className="size-4 shrink-0 accent-[#5b45c9]"
                />
                <button type="button" onClick={() => setSel(i)} className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-[14px] font-bold text-night">{s.collectionName || s.name}</span>
                  <span className="truncate text-[12px] text-slate">
                    {s.rowCount.toLocaleString("en")} rows · {s.columns.filter((c) => c.include).length} fields
                    {s.columns.some((c) => c.include && c.type === "reference") ? " · linked" : ""}
                  </span>
                </button>
              </div>
            ))}
          </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Selected sheet */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-card shadow-[0_1px_2px_rgba(15,18,32,0.04)]">
          <div className="grid gap-4 border-b border-neutral-200 p-5 lg:grid-cols-[1.4fr_1fr_1fr]">
            <Field label="Collection" htmlFor="c-name" hint={<span className="font-mono">/v1/{meta.slug || "…"}/{p.slug}</span>}>
              <div className="flex gap-2">
                <input id="c-name" value={p.collectionName} maxLength={60} onChange={(e) => updateSheet((s) => void (s.collectionName = e.target.value))} className={inputCls} />
                <input
                  aria-label="Collection path"
                  value={p.slug}
                  maxLength={48}
                  onChange={(e) => updateSheet((s) => void (s.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")))}
                  className={cx(inputCls, "w-[42%] font-mono text-[12.5px]")}
                  spellCheck={false}
                />
              </div>
            </Field>
              <Field label="Header row" htmlFor="c-header">
                <select
                  id="c-header"
                  value={p.headerRow}
                  onChange={(e) =>
                    update((d) => {
                      const at = plan.sheets.indexOf(p);
                      const fresh = planSheet(raw, Number(e.target.value));
                      d.sheets[at] = { ...fresh, include: p.include, slug: p.slug, collectionName: p.collectionName };
                      linkSheets(d, sheets);
                    })
                  }
                  className={selectCls}
                >
                  {headerOptions.map((o) => (
                    <option key={o.i} value={o.i}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Record IDs from" htmlFor="c-id" hint="Used in URLs, e.g. …/kerala">
                <select
                  id="c-id"
                  value={p.id.kind === "row" ? "row" : `${p.id.kind}:${p.id.index}`}
                  onChange={(e) =>
                    updateSheet((s) => {
                      const v = e.target.value;
                      s.id = v === "row" ? { kind: "row" } : { kind: "name", index: Number(v.split(":")[1]) };
                    })
                  }
                  className={selectCls}
                >
                  {p.columns.map((c) => (
                    <option key={c.index} value={`${p.id.kind === "column" && p.id.index === c.index ? "column" : "name"}:${c.index}`}>
                      {c.header || c.key}
                    </option>
                  ))}
                  <option value="row">Row number</option>
                </select>
              </Field>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-paper/50 font-mono text-[10.5px] tracking-[0.05em] text-slate uppercase">
                  <th className="w-10 py-2.5 pl-5 font-normal" />
                  <th className="px-3 py-2.5 font-normal">Column</th>
                  <th className="px-3 py-2.5 font-normal">Type</th>
                  <th className="px-3 py-2.5 text-center font-normal">Required</th>
                  <th className="py-2.5 pr-5 pl-3 font-normal">Sample values</th>
                </tr>
              </thead>
              <tbody>
                {p.columns.map((c, i) => {
                  const misfits = bad[c.key] ?? 0;
                  return (
                    <tr key={c.index} className={cx("border-b border-neutral-200/60 align-top last:border-0", !c.include && "bg-paper/60")}>
                      <td className="py-3 pl-5">
                        <input type="checkbox" checked={c.include} aria-label={`Include ${c.header}`} onChange={() => updateCol(i, (x) => void (x.include = !x.include))} className="mt-2 size-4 accent-[#5b45c9]" />
                      </td>
                      <td className={cx("px-3 py-3", !c.include && "opacity-50")}>
                        <div className="flex flex-col gap-1">
                          <span className="text-[14px] font-bold text-night">{c.header || <span className="text-slate italic">Untitled</span>}</span>
                          <input
                            aria-label={`Field key for ${c.header}`}
                            value={c.key}
                            disabled={!c.include}
                            maxLength={40}
                            onChange={(e) => updateCol(i, (x) => void (x.key = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")))}
                            className="w-full max-w-[200px] rounded-md bg-transparent px-1.5 py-0.5 font-mono text-[12px] text-slate ring-1 ring-transparent transition outline-none hover:ring-neutral-200 focus:bg-card focus:text-night focus:ring-ion"
                            spellCheck={false}
                          />
                        </div>
                      </td>
                      <td className={cx("px-3 py-3", !c.include && "opacity-50")}>
                        <div className="flex flex-col gap-1">
                          <select
                            aria-label={`Type of ${c.header}`}
                            value={typeValue(c)}
                            disabled={!c.include}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateCol(i, (x) => (v.startsWith("ref:") ? retype(raw, p, x, "reference", v.slice(4)) : retype(raw, p, x, v as FieldType)));
                            }}
                            className={cx(selectCls, "w-[176px] py-1.5")}
                          >
                            {Object.entries(TYPE_LABELS).map(([t, label]) => (
                              <option key={t} value={t}>
                                {label}
                              </option>
                            ))}
                            {linkable.length > 0 && (
                              <optgroup label="Link to another sheet">
                                {linkable.map((s) => (
                                  <option key={s.name} value={`ref:${s.name}`}>
                                    Rows of {s.collectionName || s.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {c.type === "reference" && !linkable.some((s) => s.name === c.targetSheet) && <option value={typeValue(c)}>Rows of {c.targetSheet} (excluded)</option>}
                          </select>
                          <span className="text-[12px] text-slate">
                            <Detail c={c} />
                          </span>
                          {misfits > 0 && c.include && (
                            <span className="inline-flex items-center gap-1 text-[12px] text-[#8a5a00]">
                              <AlertTriangle className="size-3.5" /> {misfits} cell{misfits === 1 ? "" : "s"} won&apos;t fit, left empty
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={c.required}
                          disabled={!c.include}
                          aria-label={`${c.header} is required`}
                          title={c.stats.filled < p.rowCount ? "Some rows are empty, so it can't be required" : "Every record must have it"}
                          onChange={() => updateCol(i, (x) => void (x.required = !x.required))}
                          className="mt-2 size-4 accent-[#5b45c9]"
                        />
                      </td>
                      <td className={cx("py-3 pr-5 pl-3", !c.include && "opacity-50")}>
                        <div className="flex max-w-[320px] flex-wrap gap-1.5">
                          {c.stats.samples.length ? (
                            c.stats.samples.map((s, k) => (
                              <span key={k} className="max-w-[150px] truncate rounded-md bg-neutral-100 px-1.5 py-0.5 text-[12px] text-ink-2" title={s}>
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-[12px] text-slate">Empty column</span>
                          )}
                        </div>
                        <p className="mt-1 text-[11.5px] text-slate">
                          {c.stats.filled.toLocaleString("en")} filled · {c.stats.distinct.toLocaleString("en")} distinct
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Preview */}
        <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
          <section className="dark-mode overflow-hidden rounded-xl border border-line-dark bg-night">
            <div className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-2.5">
              <span className="label text-[10.5px] text-mist-2">Live preview</span>
              <span className="font-mono text-[11px] text-[#7fe0a6]">200</span>
            </div>
            <p className="truncate border-b border-white/8 px-4 py-2 font-mono text-[11.5px] text-mist">
              <span className="text-photon">GET</span> {preview?.path ?? `/v1/${meta.slug || "…"}/${p.slug}/…`}
            </p>
            <pre className="max-h-[460px] overflow-auto px-4 py-3 font-mono text-[11.5px] leading-[1.7] text-mist">
              <code>{preview ? <Highlight code={preview.json} /> : <span className="text-mist-2">{p.include ? "Fix the problems below to see the response." : "This sheet isn't included."}</span>}</code>
            </pre>
          </section>
          <p className="px-1 text-[12.5px] leading-relaxed text-slate">
            Every collection gets list, detail, search and random endpoints. Choice and link columns become filters, e.g.{" "}
            <span className="font-mono text-night">?{p.columns.find((c) => c.include && (c.type === "enum" || c.type === "reference"))?.key ?? "field"}=…</span>. You can fine-tune
            all of it in the schema designer afterwards.
          </p>
        </aside>
      </div>

      {build.issues.length > 0 && (
        <section className="rounded-xl border border-[#f5dca8] bg-[#fffaf0]">
          <button type="button" onClick={() => setShowIssues((v) => !v)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
            <span className="flex items-center gap-2 text-[14px] text-[#7a4f00]">
              <AlertTriangle className="size-4" />
              <span>
                <span className="font-bold">{totalBad.toLocaleString("en")} cell{totalBad === 1 ? "" : "s"}</span> don&apos;t match their column&apos;s type and will be left empty.
              </span>
            </span>
            <span className="text-[13px] font-bold text-[#7a4f00]">{showIssues ? "Hide" : "Show"}</span>
          </button>
          {showIssues && (
            <ul className="max-h-[260px] overflow-auto border-t border-[#f5dca8] px-5 py-3 font-mono text-[12px] text-[#7a4f00]">
              {build.issues.slice(0, 200).map((it, k) => (
                <li key={k} className="py-0.5">
                  {it.sheet} · row {it.row} · {it.column}: {it.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-card/95 shadow-[0_-8px_24px_rgba(15,18,32,0.06)] backdrop-blur lg:left-[256px]">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <Button size="sm" color="tertiary" iconLeading={<ArrowLeft data-icon="leading" />} onPress={onBack}>
            Choose another file
          </Button>
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
            {build.problems.length ? (
              <p className="text-[13.5px] text-[#a12b2b]">
                <span className="font-bold">Can&apos;t create yet:</span> {build.problems[0]}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-[13.5px] text-ink-2">
                <CheckCircle className="size-4 text-[#22a05a]" />
                {included.length} collection{included.length === 1 ? "" : "s"} · {fieldCount} fields · {build.records.toLocaleString("en")} records
                <span className="text-slate">
                  {" "}
                  → {host}/v1/{meta.slug || "…"}
                </span>
              </p>
            )}
            <Button size="md" isDisabled={!canCreate} onPress={onCreate}>
              Create API
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

