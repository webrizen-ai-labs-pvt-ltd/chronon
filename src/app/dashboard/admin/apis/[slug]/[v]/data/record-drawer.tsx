"use client";

import { useState } from "react";
import { Drawer, Field as FormField, Switch, TagInput } from "@/components/admin/interactive";
import { Alert, inputCls, selectCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import type { Collection, Field } from "@/lib/builder/definition";
import { singular } from "@/lib/builder/words";
import { checkValue, type RecordErrors } from "@/lib/builder/records";
import { cx } from "@/utils/cx";

export type RefOptions = Record<string, { slug: string; name: string | null }[]>;
type Draft = { slug: string; data: Record<string, unknown> };

function slugFrom(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function Control({ f, value, onChange, invalid, refs }: { f: Field; value: unknown; onChange: (v: unknown) => void; invalid: boolean; refs: RefOptions }) {
  const id = `r-${f.key}`;
  const str = typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
  switch (f.type) {
    case "longtext":
      return <textarea id={id} value={str} onChange={(e) => onChange(e.target.value)} rows={4} maxLength={f.maxLength} className={cx(inputCls, "resize-y")} aria-invalid={invalid} />;
    case "integer":
    case "number":
      return (
        <input
          id={id}
          type="number"
          inputMode={f.type === "integer" ? "numeric" : "decimal"}
          step={f.type === "integer" ? 1 : "any"}
          min={f.min}
          max={f.max}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={inputCls}
          aria-invalid={invalid}
        />
      );
    case "boolean":
      return <Switch isSelected={value === true} onChange={onChange} label={value === true ? "True" : "False"} />;
    case "enum":
      return (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} className={selectCls} aria-invalid={invalid}>
          <option value="">{f.required ? "Choose…" : "None"}</option>
          {f.values?.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      );
    case "list": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      if (f.itemType === "enum") {
        return (
          <div className="flex flex-wrap gap-2" id={id}>
            {f.values?.map((v) => {
              const on = list.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? list.filter((x) => x !== v) : [...list, v])}
                  className={cx("rounded-md px-2 py-1 text-[13px] ring-1 transition ring-inset", on ? "bg-[#f3f0fd] text-ion ring-ion/40" : "bg-card text-slate ring-neutral-200 hover:text-night")}
                >
                  {v}
                </button>
              );
            })}
          </div>
        );
      }
      return <TagInput id={id} value={list} onChange={onChange} placeholder="Type and press Enter" invalid={invalid} />;
    }
    case "date":
      return <input id={id} type="date" value={str} onChange={(e) => onChange(e.target.value || null)} className={inputCls} aria-invalid={invalid} />;
    case "url":
      return <input id={id} type="url" value={str} onChange={(e) => onChange(e.target.value)} placeholder="https://" className={inputCls} aria-invalid={invalid} />;
    case "reference": {
      const options = refs[f.target ?? ""] ?? [];
      if (options.length <= 500) {
        return (
          <select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} className={selectCls} aria-invalid={invalid}>
            <option value="">{f.required ? "Choose…" : "None"}</option>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name ? `${o.name} (${o.slug})` : o.slug}
              </option>
            ))}
          </select>
        );
      }
      return (
        <>
          <input id={id} list={`${id}-list`} value={str} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, "font-mono text-[12.5px]")} aria-invalid={invalid} />
          <datalist id={`${id}-list`}>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name ?? ""}
              </option>
            ))}
          </datalist>
        </>
      );
    }
    default:
      return <input id={id} value={str} onChange={(e) => onChange(e.target.value)} maxLength={f.maxLength} className={inputCls} aria-invalid={invalid} />;
  }
}

/** Create or edit one record, with the same validation the server applies. Re-key it on each open. */
export function RecordDrawer({
  open,
  onOpenChange,
  collection,
  initial,
  refs,
  readOnly,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  collection: Collection;
  initial: Draft | null;
  refs: RefOptions;
  readOnly: boolean;
  onSave: (draft: Draft, originalSlug: string | null) => Promise<{ ok: boolean; error?: string; fields?: RecordErrors }>;
  onDelete: (slug: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [draft, setDraft] = useState<Draft>(() => (initial ? structuredClone(initial) : { slug: "", data: {} }));
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [errors, setErrors] = useState<RecordErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleField = collection.fields.find((f) => f.type === "text");

  const setValue = (f: Field, v: unknown) => {
    setDraft((d) => ({
      slug: !slugTouched && f === titleField && typeof v === "string" ? slugFrom(v) : d.slug,
      data: { ...d.data, [f.key]: v },
    }));
    if (errors[f.key]) {
      const res = checkValue(f, v);
      if (!("error" in res)) setErrors(({ [f.key]: _gone, ...rest }) => rest);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      width={620}
      title={initial ? (titleField && typeof initial.data[titleField.key] === "string" ? String(initial.data[titleField.key]) : initial.slug) : `New ${singular(collection.name)}`}
      description={initial ? <span className="font-mono">{collection.slug}/{initial.slug}</span> : collection.name}
      footer={
        readOnly ? (
          <Button size="sm" color="secondary" onPress={() => onOpenChange(false)}>
            Close
          </Button>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <div>
              {initial &&
                (confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#a12b2b]">Delete this record?</span>
                    <Button
                      size="xs"
                      color="primary-destructive"
                      isLoading={busy === "delete"}
                      onPress={async () => {
                        setBusy("delete");
                        const res = await onDelete(initial.slug);
                        setBusy(null);
                        if (res.ok) onOpenChange(false);
                        else {
                          setError(res.error ?? "Couldn't delete.");
                          setConfirmDelete(false);
                        }
                      }}
                    >
                      Delete
                    </Button>
                    <Button size="xs" color="secondary" onPress={() => setConfirmDelete(false)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" color="tertiary-destructive" onPress={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" color="secondary" onPress={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={busy === "save"}
                onPress={async () => {
                  setBusy("save");
                  setError(null);
                  const res = await onSave(draft, initial?.slug ?? null);
                  setBusy(null);
                  if (res.ok) onOpenChange(false);
                  else {
                    setErrors(res.fields ?? {});
                    setError(res.error ?? "Couldn't save.");
                  }
                }}
              >
                {initial ? "Save changes" : "Create record"}
              </Button>
            </div>
          </div>
        )
      }
    >
      <fieldset disabled={readOnly} className="flex flex-col gap-5">
        {error && <Alert tone="error">{error}</Alert>}
        {collection.fields.map((f) => (
          <FormField key={f.key} label={f.label} required={f.required} htmlFor={`r-${f.key}`} error={errors[f.key]} hint={f.description || undefined}>
            <Control f={f} value={draft.data[f.key]} onChange={(v) => setValue(f, v)} invalid={Boolean(errors[f.key])} refs={refs} />
          </FormField>
        ))}
        <FormField label="Slug" required htmlFor="r-slug" error={errors.slug} hint={`Used in the URL: /${collection.slug}/${draft.slug || "…"}`}>
          <input
            id="r-slug"
            value={draft.slug}
            maxLength={48}
            onChange={(e) => {
              setSlugTouched(true);
              setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase() }));
            }}
            className={cx(inputCls, "font-mono text-[12.5px]")}
            spellCheck={false}
            aria-invalid={Boolean(errors.slug)}
          />
        </FormField>
      </fieldset>
    </Drawer>
  );
}
