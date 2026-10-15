"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Download01, Plus, SearchLg, Trash01, Upload01 } from "@untitledui/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DialogBox } from "@/components/admin/interactive";
import { startNavProgress } from "@/components/admin/nav-progress";
import { EmptyState, inputCls, tdCls, thCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import type { Collection, Field } from "@/lib/builder/definition";
import { validateRecord } from "@/lib/builder/records";
import { timeAgo } from "@/lib/format";
import { cx } from "@/utils/cx";
import { deleteRecordsAction, importRecordsAction, saveRecordAction } from "../../../actions";
import { ImportDrawer } from "./import-drawer";
import { RecordDrawer, type RefOptions } from "./record-drawer";

type Row = { slug: string; data: Record<string, unknown>; updatedAt: string };

function preview(f: Field, v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-mist-2">—</span>;
  if (Array.isArray(v)) return v.length ? v.join(", ") : <span className="text-mist-2">—</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (f.type === "reference") return <span className="font-mono text-[12.5px]">{String(v)}</span>;
  return String(v);
}

export function DataGrid({
  slug,
  version,
  collections,
  collection,
  rows,
  total,
  page,
  pageSize,
  q,
  refs,
  readOnly,
  exportBase,
}: {
  slug: string;
  version: number;
  collections: { slug: string; name: string; count: number }[];
  collection: Collection;
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  refs: RefOptions;
  readOnly: boolean;
  exportBase: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ open: boolean; row: Row | null; n: number }>({ open: false, row: null, n: 0 });
  const [importing, setImporting] = useState({ open: false, n: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState(q);

  const columns = collection.fields.slice(0, 5);
  const refExists = (c: string, s: string) => (refs[c] ? refs[c].some((o) => o.slug === s) : true);
  const invalid = useMemo(() => new Set(rows.filter((r) => !validateRecord(collection, r, refExists).ok).map((r) => r.slug)), [rows, collection, refs]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setSelected(new Set());
    startNavProgress();
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };
  const refresh = () => startTransition(() => router.refresh());
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.slug));

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex overflow-x-auto rounded-lg bg-neutral-100 p-0.5 ring-1 ring-neutral-200 ring-inset" role="tablist" aria-label="Collection">
            {collections.map((c) => (
              <button
                key={c.slug}
                role="tab"
                aria-selected={c.slug === collection.slug}
                onClick={() => go({ collection: c.slug, page: null, q: null })}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13.5px] font-semibold whitespace-nowrap transition",
                  c.slug === collection.slug ? "bg-card text-night shadow-xs" : "text-slate hover:text-night",
                )}
              >
                {c.name}
                <span className="font-mono text-[11.5px] text-slate">{c.count.toLocaleString("en")}</span>
              </button>
            ))}
          </div>
          <form
            role="search"
            className="relative w-full sm:w-[280px]"
            onSubmit={(e) => {
              e.preventDefault();
              go({ q: search.trim() || null, page: null });
            }}
          >
            <SearchLg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records" aria-label="Search records" className={cx(inputCls, "pl-9")} />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && !readOnly && (
            <Button size="sm" color="secondary-destructive" iconLeading={<Trash01 data-icon="leading" />} onPress={() => setConfirmBulk(true)}>
              Delete {selected.size}
            </Button>
          )}
          <Button size="sm" color="secondary" href={`${exportBase}?collection=${collection.slug}`} iconLeading={<Download01 data-icon="leading" />}>
            Export
          </Button>
          {!readOnly && (
            <>
              <Button size="sm" color="secondary" iconLeading={<Upload01 data-icon="leading" />} onPress={() => setImporting((i) => ({ open: true, n: i.n + 1 }))}>
                Import
              </Button>
              <Button size="sm" iconLeading={<Plus data-icon="leading" />} onPress={() => setEditing((e) => ({ open: true, row: null, n: e.n + 1 }))}>
                New record
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className={cx("overflow-hidden rounded-xl border border-neutral-200 bg-card shadow-xs transition-opacity", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Plus />}
            title={q ? "No matching records" : `No ${collection.name.toLowerCase()} yet`}
            description={q ? `Nothing matches "${q}".` : "Add records one by one, or import a CSV or JSON file."}
            action={
              !q && !readOnly ? (
                <div className="flex gap-2">
                  <Button size="sm" color="secondary" onPress={() => setImporting((i) => ({ open: true, n: i.n + 1 }))} iconLeading={<Upload01 data-icon="leading" />}>
                    Import
                  </Button>
                  <Button size="sm" onPress={() => setEditing((e) => ({ open: true, row: null, n: e.n + 1 }))} iconLeading={<Plus data-icon="leading" />}>
                    New record
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]" style={{ minWidth: 220 + columns.length * 170 }}>
              <thead>
                <tr>
                  {!readOnly && (
                    <th className={cx(thCls, "w-10 pr-0")}>
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={allOnPage}
                        onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.slug)))}
                        className="size-4 accent-[#5b45c9]"
                      />
                    </th>
                  )}
                  <th className={thCls}>Slug</th>
                  {columns.map((f) => (
                    <th key={f.key} className={thCls}>
                      {f.label}
                    </th>
                  ))}
                  <th className={cx(thCls, "text-right")}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.slug}
                    onClick={() => setEditing((e) => ({ open: true, row: r, n: e.n + 1 }))}
                    className={cx("cursor-pointer transition hover:bg-paper/70", selected.has(r.slug) && "bg-[#f8f6fe]")}
                  >
                    {!readOnly && (
                      <td className={cx(tdCls, "pr-0")} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.slug}`}
                          checked={selected.has(r.slug)}
                          onChange={() =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (n.has(r.slug)) n.delete(r.slug);
                              else n.add(r.slug);
                              return n;
                            })
                          }
                          className="size-4 accent-[#5b45c9]"
                        />
                      </td>
                    )}
                    <td className={tdCls}>
                      <span className="flex items-center gap-1.5 font-mono text-[12.5px] whitespace-nowrap text-night">
                        {invalid.has(r.slug) && (
                          <span title="Doesn't match the current schema">
                            <AlertTriangle className="size-4 text-[#d08a00]" aria-label="Invalid record" />
                          </span>
                        )}
                        {r.slug}
                      </span>
                    </td>
                    {columns.map((f) => (
                      <td key={f.key} className={cx(tdCls, "max-w-[260px] truncate text-ink-2")}>
                        {preview(f, r.data[f.key])}
                      </td>
                    ))}
                    <td className={cx(tdCls, "text-right whitespace-nowrap text-slate")}>{timeAgo(new Date(r.updatedAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-[13px] text-slate">
            <span>
              {from.toLocaleString("en")}–{to.toLocaleString("en")} of {total.toLocaleString("en")}
              {collection.fields.length > columns.length && ` · showing ${columns.length} of ${collection.fields.length} fields`}
            </span>
            <div className="flex gap-1.5">
              <Button size="xs" color="secondary" isDisabled={page <= 1} onPress={() => go({ page: String(page - 1) })} iconLeading={<ChevronLeft data-icon="leading" />} aria-label="Previous page" />
              <Button size="xs" color="secondary" isDisabled={to >= total} onPress={() => go({ page: String(page + 1) })} iconLeading={<ChevronRight data-icon="leading" />} aria-label="Next page" />
            </div>
          </div>
        )}
      </div>

      <RecordDrawer
        key={`r${editing.n}`}
        open={editing.open}
        onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}
        collection={collection}
        initial={editing.row ? { slug: editing.row.slug, data: editing.row.data } : null}
        refs={refs}
        readOnly={readOnly}
        onSave={async (draft, original) => {
          const res = await saveRecordAction(slug, version, collection.slug, original, draft);
          if (res.ok) refresh();
          return res;
        }}
        onDelete={async (s) => {
          const res = await deleteRecordsAction(slug, version, collection.slug, [s]);
          if (res.ok) refresh();
          return res;
        }}
      />

      <ImportDrawer
        key={`i${importing.n}`}
        open={importing.open}
        onOpenChange={(open) => setImporting((i) => ({ ...i, open }))}
        collection={collection}
        exportBase={exportBase}
        onImport={async (rows, mode) => {
          const res = await importRecordsAction(slug, version, collection.slug, rows, mode);
          if (res.ok) refresh();
          return res;
        }}
      />

      <DialogBox
        open={confirmBulk}
        onOpenChange={(o) => {
          setConfirmBulk(o);
          if (!o) setBulkError(null);
        }}
        tone="danger"
        title={`Delete ${selected.size} record${selected.size === 1 ? "" : "s"}?`}
        footer={
          <>
            <Button size="sm" color="secondary" onPress={() => setConfirmBulk(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              color="primary-destructive"
              isLoading={bulkBusy}
              onPress={async () => {
                setBulkBusy(true);
                const res = await deleteRecordsAction(slug, version, collection.slug, [...selected]);
                setBulkBusy(false);
                if (res.ok) {
                  setConfirmBulk(false);
                  setSelected(new Set());
                  refresh();
                } else setBulkError(res.error);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>They disappear from the API within 15 seconds. Records other collections still reference can&apos;t be deleted.</p>
        {bulkError && <p className="mt-2 text-[#a12b2b]">{bulkError}</p>}
      </DialogBox>
    </div>
  );
}
