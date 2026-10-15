"use client";

import { useState } from "react";
import { Drawer, Field as FormField, Switch, TagInput } from "@/components/admin/interactive";
import { inputCls, selectCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import { FIELD_TYPES, KEY_RE, type Collection, type Field, type FieldType } from "@/lib/builder/definition";
import { cx } from "@/utils/cx";

export const TYPE_INFO: Record<FieldType, { label: string; hint: string }> = {
  text: { label: "Text", hint: "A short single-line string." },
  longtext: { label: "Long text", hint: "Paragraphs; line breaks are kept." },
  integer: { label: "Integer", hint: "Whole numbers, optionally within a range." },
  number: { label: "Number", hint: "Decimals allowed." },
  boolean: { label: "Boolean", hint: "true or false." },
  enum: { label: "Choice", hint: "One value from a fixed list." },
  list: { label: "List", hint: "Several text values, or several choices." },
  date: { label: "Date", hint: "Calendar date, YYYY-MM-DD." },
  url: { label: "URL", hint: "An http(s) link." },
  reference: { label: "Reference", hint: "Points at a record in another collection." },
};

function blank(): Field {
  return { key: "", label: "", type: "text", required: false, description: "" };
}

function toKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f_$1")
    .slice(0, 40);
}

const numOrUndef = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));

/**
 * Add/edit one field. Only the options that apply to the chosen type are
 * kept, so a definition never carries stale settings. Give it a fresh `key`
 * each time it opens so its form starts from `initial`.
 */
export function FieldDrawer({
  open,
  onOpenChange,
  initial,
  collection,
  collections,
  live,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Field | null;
  collection: Collection;
  collections: Collection[];
  live: boolean;
  onSave: (f: Field) => void;
}) {
  const [f, setF] = useState<Field>(initial ?? blank());
  const [keyTouched, setKeyTouched] = useState(Boolean(initial));
  const isNew = !initial;

  const set = (patch: Partial<Field>) => setF((x) => ({ ...x, ...patch }));
  const others = collection.fields.filter((x) => x.key !== initial?.key);
  const keyError = !f.key
    ? undefined
    : !KEY_RE.test(f.key)
      ? "Lowercase letters, numbers and underscores; starts with a letter."
      : f.key === "slug"
        ? '"slug" is built in.'
        : others.some((x) => x.key === f.key)
          ? "Another field uses this key."
          : undefined;
  const target = collections.find((c) => c.slug === f.target);
  const needsValues = f.type === "enum" || (f.type === "list" && f.itemType === "enum");
  const valid = f.key && f.label.trim() && !keyError && (!needsValues || f.values?.length) && (f.type !== "reference" || target);

  function clean(x: Field): Field {
    const base: Field = { key: x.key, label: x.label.trim(), type: x.type, required: x.required, description: x.description.trim() };
    if (x.type === "text" || x.type === "longtext") return { ...base, maxLength: x.maxLength, pattern: x.type === "text" && x.pattern ? x.pattern : undefined };
    if (x.type === "integer" || x.type === "number") return { ...base, min: x.min, max: x.max };
    if (x.type === "enum") return { ...base, values: x.values };
    if (x.type === "list") return { ...base, itemType: x.itemType ?? "text", values: x.itemType === "enum" ? x.values : undefined, maxLength: x.maxLength };
    if (x.type === "reference") return { ...base, target: x.target, embed: x.embed?.length ? x.embed : undefined };
    return base;
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isNew ? "Add field" : `Edit ${initial?.label}`}
      description={`${collection.name} · ${isNew ? "new field" : initial?.key}`}
      footer={
        <>
          <Button size="sm" color="secondary" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            isDisabled={!valid}
            onPress={() => {
              onSave(clean(f));
              onOpenChange(false);
            }}
          >
            {isNew ? "Add field" : "Apply"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Label" required htmlFor="f-label">
            <input
              id="f-label"
              value={f.label}
              autoFocus
              maxLength={60}
              onChange={(e) => set({ label: e.target.value, ...(keyTouched ? {} : { key: toKey(e.target.value) }) })}
              className={inputCls}
            />
          </FormField>
          <FormField label="Key" required htmlFor="f-key" error={keyError} hint={!isNew && live ? "Renaming a live field is a breaking change." : "The JSON property name."}>
            <input
              id="f-key"
              value={f.key}
              maxLength={40}
              onChange={(e) => {
                setKeyTouched(true);
                set({ key: e.target.value.toLowerCase() });
              }}
              className={cx(inputCls, "font-mono text-[12.5px]")}
              spellCheck={false}
              aria-invalid={Boolean(keyError)}
            />
          </FormField>
        </div>

        <FormField label="Type" htmlFor="f-type">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" id="f-type">
            {FIELD_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={f.type === t}
                onClick={() => set({ type: t, ...(t === "list" && !f.itemType ? { itemType: "text" } : {}) })}
                className={cx(
                  "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  f.type === t ? "border-ion bg-[#f6f3fe] ring-1 ring-ion" : "border-neutral-200 bg-card hover:border-mist-2",
                )}
              >
                <span className="text-[13.5px] font-semibold text-night">{TYPE_INFO[t].label}</span>
                <span className="text-[11.5px] leading-snug text-slate">{TYPE_INFO[t].hint}</span>
              </button>
            ))}
          </div>
        </FormField>

        {(f.type === "text" || f.type === "longtext") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Max length" htmlFor="f-max" hint="Characters. Leave empty for no limit.">
              <input id="f-max" type="number" min={1} max={20000} value={f.maxLength ?? ""} onChange={(e) => set({ maxLength: numOrUndef(e.target.value) })} className={inputCls} />
            </FormField>
            {f.type === "text" && (
              <FormField label="Pattern" htmlFor="f-pattern" hint="Optional regular expression, e.g. ^[A-Z]{2}$">
                <input id="f-pattern" value={f.pattern ?? ""} onChange={(e) => set({ pattern: e.target.value || undefined })} className={cx(inputCls, "font-mono text-[12.5px]")} spellCheck={false} />
              </FormField>
            )}
          </div>
        )}

        {(f.type === "integer" || f.type === "number") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Minimum" htmlFor="f-min">
              <input id="f-min" type="number" value={f.min ?? ""} onChange={(e) => set({ min: numOrUndef(e.target.value) })} className={inputCls} />
            </FormField>
            <FormField label="Maximum" htmlFor="f-maxn">
              <input id="f-maxn" type="number" value={f.max ?? ""} onChange={(e) => set({ max: numOrUndef(e.target.value) })} className={inputCls} />
            </FormField>
          </div>
        )}

        {f.type === "list" && (
          <FormField label="Items are" htmlFor="f-item">
            <select id="f-item" value={f.itemType ?? "text"} onChange={(e) => set({ itemType: e.target.value as "text" | "enum" })} className={selectCls}>
              <option value="text">Free text</option>
              <option value="enum">Choices from a list</option>
            </select>
          </FormField>
        )}

        {needsValues && (
          <FormField label="Allowed values" required htmlFor="f-values" hint={live && !isNew ? "On a live version you can add values but not remove them." : "Press Enter or comma to add."}>
            <TagInput id="f-values" value={f.values ?? []} onChange={(values) => set({ values })} placeholder="e.g. breakfast, main, dessert" />
          </FormField>
        )}

        {f.type === "reference" && (
          <>
            <FormField label="Points at" required htmlFor="f-target" hint="Records store the target's slug.">
              <select id="f-target" value={f.target ?? ""} onChange={(e) => set({ target: e.target.value || undefined, embed: undefined })} className={selectCls}>
                <option value="">Choose a collection…</option>
                {collections.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>
            {target && (
              <FormField label="In responses" htmlFor="f-embed" hint="Embed a few of the target's fields as an object, or return just the slug.">
                <div id="f-embed" className="flex flex-wrap gap-2">
                  {["slug", ...target.fields.map((x) => x.key)].map((k) => {
                    const on = f.embed?.includes(k) ?? false;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ embed: on ? f.embed?.filter((x) => x !== k) : [...(f.embed ?? []), k] })}
                        className={cx(
                          "rounded-md px-2 py-1 font-mono text-[12px] ring-1 transition ring-inset",
                          on ? "bg-[#f3f0fd] text-ion ring-ion/40" : "bg-card text-slate ring-neutral-200 hover:text-night",
                        )}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            )}
          </>
        )}

        <FormField label="Description" htmlFor="f-desc" hint="Shown in the generated docs.">
          <textarea id="f-desc" value={f.description} maxLength={240} rows={2} onChange={(e) => set({ description: e.target.value })} className={cx(inputCls, "resize-none")} />
        </FormField>

        <Switch isSelected={f.required} onChange={(required) => set({ required })} label="Required" description={live && !isNew && !initial?.required ? "Making a live field required is a breaking change." : "Records can't be saved without it."} />
      </div>
    </Drawer>
  );
}
