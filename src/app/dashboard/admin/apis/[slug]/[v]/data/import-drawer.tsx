"use client";

import { Upload01 } from "@untitledui/icons";
import { useRef, useState } from "react";
import { Drawer } from "@/components/admin/interactive";
import { Alert, Table, tdCls, thCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import type { Collection } from "@/lib/builder/definition";
import { mapSheet } from "@/lib/builder/infer";
import { ACCEPT, FileReadError, readWorkbook } from "@/lib/builder/read-file";
import { LIST_SEPARATOR, type RecordErrors, type RecordInput } from "@/lib/builder/records";
import { slugify } from "@/lib/builder/words";
import { cx } from "@/utils/cx";

type Parsed = ReturnType<typeof mapSheet>;
type Report = { ok: true; inserted: number; updated: number } | { ok: false; error: string; rows?: { row: number; slug: string; errors: RecordErrors }[] };

// One import is one request; Vercel caps bodies at 4.5 MB (server actions are raised to match).
const MAX_PAYLOAD = 4 * 1024 * 1024;

export function ImportDrawer({
  open,
  onOpenChange,
  collection,
  exportBase,
  onImport,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  collection: Collection;
  exportBase: string;
  onImport: (rows: RecordInput[], mode: "upsert" | "replace") => Promise<Report>;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mode, setMode] = useState<"upsert" | "replace">("upsert");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function read(file: File) {
    setReport(null);
    setError(null);
    setParsed(null);
    try {
      const sheets = await readWorkbook(file);
      // Prefer the sheet named like this collection, else the first one with data.
      const sheet = sheets.find((x) => slugify(x.name) === collection.slug || slugify(x.name) === slugify(collection.name)) ?? sheets.find((x) => x.rows.length > 1) ?? sheets[0];
      if (!sheet) return setError("That file has no rows.");
      const res = mapSheet(collection, sheet, sheets.length > 1 ? `${file.name} · ${sheet.name}` : file.name);
      if (JSON.stringify(res.rows).length > MAX_PAYLOAD) return setError("That's too much data for one import. Split the file and import it in parts.");
      setParsed(res);
    } catch (err) {
      setError(err instanceof FileReadError ? err.message : "Couldn't read that file.");
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      width={720}
      title={`Import ${collection.name.toLowerCase()}`}
      description="Excel, CSV or JSON. Every row is validated first; nothing is written unless all rows pass."
      footer={
        report?.ok ? (
          <Button size="sm" onPress={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <>
            <Button size="sm" color="secondary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isDisabled={!parsed || parsed.missing.length > 0 || parsed.rows.length === 0}
              isLoading={busy}
              onPress={async () => {
                if (!parsed) return;
                setBusy(true);
                setReport(await onImport(parsed.rows, mode));
                setBusy(false);
              }}
            >
              {parsed ? `Import ${parsed.rows.length.toLocaleString("en")} rows` : "Import"}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-6">
        {report?.ok ? (
          <Alert tone="success" title="Import complete">
            {report.inserted.toLocaleString("en")} added, {report.updated.toLocaleString("en")} updated.
          </Alert>
        ) : (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const file = e.dataTransfer.files[0];
                if (file) void read(file);
              }}
              className={cx("flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition", drag ? "border-ion bg-[#f6f3fe]" : "border-neutral-200 bg-paper")}
            >
              <span className="grid size-10 place-items-center rounded-lg border border-neutral-200 bg-card text-slate shadow-xs">
                <Upload01 className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-[14px] text-night">
                  <button type="button" onClick={() => input.current?.click()} className="font-semibold text-ion hover:underline">
                    Choose a file
                  </button>{" "}
                  or drop it here
                </p>
                <p className="text-[12.5px] text-slate">Excel (.xlsx), CSV or JSON{parsed ? ` · ${parsed.fileName}` : ""}</p>
              </div>
              <input
                ref={input}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void read(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="rounded-lg bg-paper px-4 py-3 text-[13px] leading-relaxed text-ink-2">
              Columns are matched to fields by name or label: <code className="font-mono text-night">{["slug", ...collection.fields.map((f) => f.key)].join(", ")}</code>. Separate list values with{" "}
              <code className="font-mono text-night">{LIST_SEPARATOR}</code>, a semicolon or a comma; links can use names (“Kerala”) or slugs. Start from an{" "}
              <a href={`${exportBase}?collection=${collection.slug}`} className="font-semibold text-ion no-underline hover:underline">
                export of the current data
              </a>
              .
            </div>

            {error && <Alert tone="error">{error}</Alert>}

            {parsed && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    ["Rows", parsed.rows.length.toLocaleString("en")],
                    ["Columns matched", `${parsed.columns.length - parsed.unknown.length}/${collection.fields.length + 1}`],
                    ["Ignored columns", String(parsed.unknown.length)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-neutral-200 bg-card px-3 py-3">
                      <p className="text-[20px] font-bold text-night tabular-nums">{v}</p>
                      <p className="text-[12px] text-slate">{k}</p>
                    </div>
                  ))}
                </div>
                {parsed.missing.length > 0 && <Alert tone="error">Missing required columns: {parsed.missing.join(", ")}.</Alert>}
                {parsed.note && <Alert tone="info">{parsed.note}</Alert>}
                {parsed.unknown.length > 0 && <Alert tone="warning">These columns aren&apos;t fields and will be ignored: {parsed.unknown.join(", ")}.</Alert>}

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-[13.5px] font-semibold text-night">Mode</legend>
                  {(
                    [
                      ["upsert", "Add and update", "Rows with an existing slug update that record; new slugs are added. Nothing is removed."],
                      ["replace", "Replace collection", "Records not in the file are deleted. Use for a full refresh."],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label key={value} className={cx("flex cursor-pointer gap-3 rounded-lg border p-3 transition", mode === value ? "border-ion bg-[#f6f3fe]" : "border-neutral-200 bg-card")}>
                      <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-[#5b45c9]" />
                      <span className="flex flex-col">
                        <span className="text-[14px] font-semibold text-night">{label}</span>
                        <span className="text-[13px] text-slate">{hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}

            {report && !report.ok && (
              <div className="flex flex-col gap-3">
                <Alert tone="error">{report.error}</Alert>
                {report.rows && report.rows.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-neutral-200">
                    <Table minWidth={520}>
                      <thead>
                        <tr>
                          <th className={thCls}>Row</th>
                          <th className={thCls}>Slug</th>
                          <th className={thCls}>Problem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rows.map((r) => (
                          <tr key={r.row}>
                            <td className={cx(tdCls, "font-mono text-[12.5px]")}>{r.row}</td>
                            <td className={cx(tdCls, "font-mono text-[12.5px]")}>{r.slug || "—"}</td>
                            <td className={cx(tdCls, "text-[13px]")}>
                              {Object.entries(r.errors).map(([k, v]) => (
                                <div key={k}>
                                  <span className="font-mono text-night">{k}</span>: <span className="text-[#a12b2b]">{v}</span>
                                </div>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
