"use client";

import { ArrowDown, ArrowUp, Edit03, Plus, Trash01 } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Field as FormField, Switch, TagInput } from "@/components/admin/interactive";
import { Alert, inputCls, selectCls, tdCls, thCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import { breakingChanges } from "@/lib/builder/compat";
import { checkDataset, collectionSchema, FILTER_OPS, KEY_RE, SLUG_RE, type Collection, type DatasetDefinition, type Field } from "@/lib/builder/definition";
import { cx } from "@/utils/cx";
import { saveDefinitionAction } from "../../../actions";
import { FieldDrawer, TYPE_INFO } from "./field-drawer";

const clone = <T,>(x: T): T => structuredClone(x);

function Panel({ title, description, actions, children, className }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("min-w-0 rounded-xl border border-neutral-200 bg-card shadow-xs", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[15px] font-bold text-night">{title}</h3>
          {description && <p className="text-[13px] text-slate">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const iconBtn = "grid size-8 place-items-center rounded-md text-slate transition hover:bg-neutral-100 hover:text-night disabled:pointer-events-none disabled:opacity-30";

function newCollection(existing: Collection[]): Collection {
  let n = existing.length + 1;
  while (existing.some((c) => c.slug === `collection-${n}`)) n++;
  return collectionSchema.parse({ slug: `collection-${n}`, name: `Collection ${n}`, fields: [{ key: "name", label: "Name", type: "text", required: true }], sort: [{ field: "name" }] });
}

/** Field paths a filter or search can target: own fields, slug, and fields one reference away. */
function pathOptions(def: DatasetDefinition, c: Collection) {
  const out: { value: string; label: string }[] = [{ value: "slug", label: "slug" }];
  for (const f of c.fields) {
    out.push({ value: f.key, label: f.key });
    if (f.type === "reference") {
      const t = def.collections.find((x) => x.slug === f.target);
      if (t) for (const tf of ["slug", ...t.fields.map((x) => x.key)]) out.push({ value: `${f.key}.${tf}`, label: `${f.key} → ${tf}` });
    }
  }
  return out;
}

export function SchemaDesigner({ slug, version, initial, live }: { slug: string; version: number; initial: DatasetDefinition; live: DatasetDefinition | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [def, setDef] = useState(initial);
  const [sel, setSel] = useState(0);
  const [drawer, setDrawer] = useState<{ open: boolean; field: Field | null; n: number }>({ open: false, field: null, n: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(def) !== JSON.stringify(saved), [def, saved]);
  const problems = useMemo(() => checkDataset(def), [def]);
  const breaking = useMemo(() => (live ? breakingChanges(live, def) : []), [live, def]);
  const c = def.collections[Math.min(sel, def.collections.length - 1)];
  const idx = def.collections.indexOf(c);

  const update = (fn: (d: DatasetDefinition) => void) =>
    setDef((d) => {
      const next = clone(d);
      fn(next);
      return next;
    });
  const updateC = (fn: (c: Collection, d: DatasetDefinition) => void) => update((d) => fn(d.collections[idx], d));
  const paths = pathOptions(def, c);
  const backRefs = def.collections.flatMap((o) => o.fields.filter((f) => f.type === "reference" && f.target === c.slug).map((f) => ({ collection: o.slug, via: f.key })));

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await saveDefinitionAction(slug, version, def);
    setBusy(false);
    if (res.ok) {
      setSaved(def);
      setNotice("Schema saved. Live traffic picks it up within 15 seconds.");
      router.refresh();
    } else setError(res.error);
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {live && (
        <Alert tone="info" title={`v${version} is live`}>
          Additive changes only: new optional fields, new choice values, filters, collections and endpoints. Removing or tightening anything belongs in a new
          version.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Collections */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[84px] lg:self-start">
          <div className="rounded-xl border border-neutral-200 bg-card p-2 shadow-xs">
            <p className="label px-2 pt-1.5 pb-2 text-slate">Collections</p>
            <ul className="flex flex-col gap-0.5">
              {def.collections.map((x, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSel(i)}
                    className={cx(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition",
                      i === idx ? "bg-[#f3f0fd] text-night" : "text-ink-2 hover:bg-neutral-100",
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-semibold">{x.name}</span>
                      <span className="truncate font-mono text-[11.5px] text-slate">/{x.slug}</span>
                    </span>
                    <span className="font-mono text-[11.5px] text-slate">{x.fields.length}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={def.collections.length >= 8}
              onClick={() => {
                update((d) => d.collections.push(newCollection(d.collections)));
                setSel(def.collections.length);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold text-ion transition hover:bg-neutral-100 disabled:opacity-40"
            >
              <Plus className="size-4" /> Add collection
            </button>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-card p-4 shadow-xs">
            <FormField label="Random shortcut" htmlFor="alias" hint={`Serves /v${version}/${slug}/random from one collection.`}>
              <select
                id="alias"
                value={def.randomAlias ?? ""}
                onChange={(e) => update((d) => void (d.randomAlias = e.target.value || null))}
                className={selectCls}
              >
                <option value="">Off</option>
                {def.collections
                  .filter((x) => x.random.enabled)
                  .map((x) => (
                    <option key={x.slug} value={x.slug}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </FormField>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {/* General */}
          <Panel
            title="Collection"
            actions={
              def.collections.length > 1 && (
                <Button
                  size="xs"
                  color="secondary-destructive"
                  iconLeading={<Trash01 data-icon="leading" />}
                  onPress={() => {
                    update((d) => {
                      d.collections.splice(idx, 1);
                      if (d.randomAlias === c.slug) d.randomAlias = null;
                    });
                    setSel(0);
                  }}
                >
                  Remove collection
                </Button>
              )
            }
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <FormField label="Name" htmlFor="c-name">
                <input id="c-name" value={c.name} maxLength={60} onChange={(e) => updateC((x) => void (x.name = e.target.value))} className={inputCls} />
              </FormField>
              <FormField
                label="Path"
                htmlFor="c-slug"
                error={!SLUG_RE.test(c.slug) ? "lowercase-kebab-case" : undefined}
                hint={<span className="font-mono">/v{version}/{slug}/{c.slug}</span>}
              >
                <input id="c-slug" value={c.slug} maxLength={48} onChange={(e) => updateC((x) => void (x.slug = e.target.value.toLowerCase()))} className={cx(inputCls, "font-mono text-[12.5px]")} spellCheck={false} />
              </FormField>
              <FormField label="Description" htmlFor="c-desc" className="sm:col-span-2" hint="Shown in the generated docs.">
                <input id="c-desc" value={c.description} maxLength={400} onChange={(e) => updateC((x) => void (x.description = e.target.value))} className={inputCls} />
              </FormField>
            </div>
          </Panel>

          {/* Fields */}
          <Panel
            title="Fields"
            description="Every record has a built-in, unique slug. Fields follow in this order in responses."
            actions={
              <Button size="sm" iconLeading={<Plus data-icon="leading" />} onPress={() => setDrawer((d) => ({ open: true, field: null, n: d.n + 1 }))} isDisabled={c.fields.length >= 60}>
                Add field
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[14px]">
                <thead>
                  <tr>
                    <th className={thCls}>Field</th>
                    <th className={thCls}>Type</th>
                    <th className={thCls}>Rules</th>
                    <th className={cx(thCls, "w-[132px]")} />
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate">
                    <td className={tdCls}>
                      <span className="font-mono text-[13px]">slug</span>
                    </td>
                    <td className={tdCls}>Slug</td>
                    <td className={tdCls}>Required · unique</td>
                    <td className={tdCls} />
                  </tr>
                  {c.fields.map((f, i) => (
                    <tr key={f.key + i} className="group">
                      <td className={tdCls}>
                        <div className="flex flex-col">
                          <span className="font-semibold text-night">{f.label}</span>
                          <span className="font-mono text-[12px] text-slate">{f.key}</span>
                        </div>
                      </td>
                      <td className={tdCls}>
                        <span className="text-night">{TYPE_INFO[f.type].label}</span>
                        {f.type === "reference" && <span className="text-slate"> → {f.target}</span>}
                        {f.type === "list" && <span className="text-slate"> of {f.itemType === "enum" ? "choices" : "text"}</span>}
                      </td>
                      <td className={cx(tdCls, "text-[13px] text-slate")}>
                        {[
                          f.required && "Required",
                          f.values?.length && `${f.values.length} values`,
                          f.maxLength && `≤ ${f.maxLength} chars`,
                          (f.min !== undefined || f.max !== undefined) && `${f.min ?? "…"}–${f.max ?? "…"}`,
                          f.pattern && "Pattern",
                          f.embed?.length && `Embeds ${f.embed.join(", ")}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className={cx(tdCls, "text-right")}>
                        <div className="flex justify-end gap-0.5">
                          <button type="button" className={iconBtn} aria-label="Move up" disabled={i === 0} onClick={() => updateC((x) => x.fields.splice(i - 1, 0, x.fields.splice(i, 1)[0]))}>
                            <ArrowUp className="size-4" />
                          </button>
                          <button type="button" className={iconBtn} aria-label="Move down" disabled={i === c.fields.length - 1} onClick={() => updateC((x) => x.fields.splice(i + 1, 0, x.fields.splice(i, 1)[0]))}>
                            <ArrowDown className="size-4" />
                          </button>
                          <button type="button" className={iconBtn} aria-label={`Edit ${f.label}`} onClick={() => setDrawer((d) => ({ open: true, field: f, n: d.n + 1 }))}>
                            <Edit03 className="size-4" />
                          </button>
                          <button type="button" className={cx(iconBtn, "hover:bg-[#fdecec] hover:text-[#a12b2b]")} aria-label={`Remove ${f.label}`} onClick={() => updateC((x) => void x.fields.splice(i, 1))}>
                            <Trash01 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Endpoints */}
          <Panel title="Endpoints" description="Which routes this collection serves, and how lists are ordered and paged.">
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Switch isSelected={c.list.enabled} onChange={(v) => updateC((x) => void (x.list.enabled = v))} label="List" description={`GET /${c.slug}`} />
                {c.list.enabled && (
                  <div className="ml-12 flex flex-col gap-4">
                    <Switch isSelected={c.list.paginate} onChange={(v) => updateC((x) => void (x.list.paginate = v))} label="Paginate" description="Cursor pagination with limit and next_cursor." />
                    {c.list.paginate && (
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Default page" htmlFor="dl">
                          <input id="dl" type="number" min={1} max={100} value={c.list.defaultLimit} onChange={(e) => updateC((x) => void (x.list.defaultLimit = Math.max(1, Math.min(100, Number(e.target.value) || 1))))} className={inputCls} />
                        </FormField>
                        <FormField label="Max page" htmlFor="ml">
                          <input id="ml" type="number" min={1} max={100} value={c.list.maxLimit} onChange={(e) => updateC((x) => void (x.list.maxLimit = Math.max(1, Math.min(100, Number(e.target.value) || 1))))} className={inputCls} />
                        </FormField>
                      </div>
                    )}
                  </div>
                )}
                <Switch isSelected={c.detail.enabled} onChange={(v) => updateC((x) => void (x.detail.enabled = v))} label="Detail" description={`GET /${c.slug}/{slug}`} />
                <Switch isSelected={c.random.enabled} onChange={(v) => updateC((x, d) => {
                  x.random.enabled = v;
                  if (!v && d.randomAlias === x.slug) d.randomAlias = null;
                })} label="Random" description={`GET /${c.slug}/random?count=`} />
                {c.random.enabled && (
                  <div className="ml-12 max-w-[160px]">
                    <FormField label="Max count" htmlFor="rc">
                      <input id="rc" type="number" min={1} max={50} value={c.random.maxCount} onChange={(e) => updateC((x) => void (x.random.maxCount = Math.max(1, Math.min(50, Number(e.target.value) || 1))))} className={inputCls} />
                    </FormField>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-[13.5px] font-semibold text-night">Sort order</p>
                {c.sort.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <select value={s.field} onChange={(e) => updateC((x) => void (x.sort[i].field = e.target.value))} className={selectCls} aria-label="Sort field">
                      {["slug", ...c.fields.map((f) => f.key)].map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <select value={s.dir} onChange={(e) => updateC((x) => void (x.sort[i].dir = e.target.value as "asc" | "desc"))} className={cx(selectCls, "w-[120px] shrink-0")} aria-label="Direction">
                      <option value="asc">A → Z</option>
                      <option value="desc">Z → A</option>
                    </select>
                    <button type="button" className={iconBtn} aria-label="Remove sort" onClick={() => updateC((x) => void x.sort.splice(i, 1))}>
                      <Trash01 className="size-4" />
                    </button>
                  </div>
                ))}
                {c.sort.length < 4 && (
                  <button type="button" onClick={() => updateC((x) => void x.sort.push({ field: x.fields[0]?.key ?? "slug", dir: "asc" }))} className="flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-ion">
                    <Plus className="size-4" /> {c.sort.length ? "Then by" : "Sort by"}
                  </button>
                )}
                {!c.sort.length && <p className="text-[13px] text-slate">Without a sort, records come back in import order.</p>}
              </div>
            </div>
          </Panel>

          {/* Filters */}
          <Panel
            title="Filters"
            description="Query parameters that narrow lists and random picks."
            actions={
              <Button size="sm" color="secondary" iconLeading={<Plus data-icon="leading" />} isDisabled={c.filters.length >= 20} onPress={() => updateC((x) => void x.filters.push({ param: `filter_${x.filters.length + 1}`, path: x.fields[0]?.key ?? "slug", op: "eq", caseInsensitive: false, description: "" }))}>
                Add filter
              </Button>
            }
          >
            {c.filters.length === 0 ? (
              <p className="px-5 py-6 text-[14px] text-slate">No filters. Add one to let callers query by a field, e.g. ?country=IN.</p>
            ) : (
              <ul className="divide-y divide-neutral-200">
                {c.filters.map((fl, i) => {
                  const fieldDef = c.fields.find((f) => f.key === fl.path);
                  const isEnum = fieldDef?.type === "enum";
                  return (
                    <li key={i} className="flex flex-col gap-3 px-5 py-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_1fr_auto] sm:items-end">
                        <FormField label="Parameter" htmlFor={`fp${i}`} error={!KEY_RE.test(fl.param) ? "snake_case" : undefined}>
                          <input id={`fp${i}`} value={fl.param} onChange={(e) => updateC((x) => void (x.filters[i].param = e.target.value.toLowerCase()))} className={cx(inputCls, "font-mono text-[12.5px]")} spellCheck={false} />
                        </FormField>
                        <FormField label="Field" htmlFor={`fpath${i}`}>
                          <select id={`fpath${i}`} value={fl.path} onChange={(e) => updateC((x) => void (x.filters[i].path = e.target.value))} className={selectCls}>
                            {paths.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="Match" htmlFor={`fop${i}`}>
                          <select id={`fop${i}`} value={fl.op} onChange={(e) => updateC((x) => void (x.filters[i].op = e.target.value as (typeof FILTER_OPS)[number]))} className={selectCls}>
                            <option value="eq">equals</option>
                            <option value="lte">at most (≤)</option>
                            <option value="gte">at least (≥)</option>
                            <option value="contains">contains</option>
                          </select>
                        </FormField>
                        <button type="button" className={cx(iconBtn, "mb-1")} aria-label={`Remove filter ${fl.param}`} onClick={() => updateC((x) => void x.filters.splice(i, 1))}>
                          <Trash01 className="size-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-x-8 gap-y-3">
                        <Switch isSelected={fl.caseInsensitive} onChange={(v) => updateC((x) => void (x.filters[i].caseInsensitive = v))} label="Ignore case" />
                        {isEnum && fl.op === "eq" && (
                          <Switch
                            isSelected={Boolean(fl.implies)}
                            onChange={(v) => updateC((x) => void (x.filters[i].implies = v ? Object.fromEntries((fieldDef.values ?? []).map((val) => [val, [val]])) : undefined))}
                            label="Broader matches"
                            description="A value can also match others, e.g. vegetarian also matches vegan."
                          />
                        )}
                      </div>
                      {isEnum && fl.implies && (
                        <div className="grid gap-2 rounded-lg bg-paper p-3">
                          {(fieldDef.values ?? []).map((val) => (
                            <div key={val} className="grid items-center gap-2 sm:grid-cols-[160px_1fr]">
                              <span className="font-mono text-[12.5px] text-night">?{fl.param}={val}</span>
                              <TagInput
                                value={fl.implies?.[val] ?? [val]}
                                onChange={(list) => updateC((x) => void (x.filters[i].implies = { ...x.filters[i].implies, [val]: list.filter((l) => fieldDef.values?.includes(l)) }))}
                                placeholder="matches…"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Search */}
          <Panel title="Search" description="Full-text search that ignores case and accents.">
            <div className="flex flex-col gap-4 p-5">
              <Switch isSelected={c.search.enabled} onChange={(v) => updateC((x) => void (x.search.enabled = v))} label="Enable search" />
              {c.search.enabled && (
                <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                  <FormField label="Parameter" htmlFor="sp">
                    <input id="sp" value={c.search.param} onChange={(e) => updateC((x) => void (x.search.param = e.target.value.toLowerCase()))} className={cx(inputCls, "font-mono text-[12.5px]")} spellCheck={false} />
                  </FormField>
                  <FormField label="Searches" htmlFor="sf">
                    <div id="sf" className="flex flex-wrap gap-2">
                      {paths
                        .filter((p) => p.value !== "slug")
                        .map((p) => {
                          const on = c.search.fields.includes(p.value);
                          return (
                            <button
                              key={p.value}
                              type="button"
                              aria-pressed={on}
                              onClick={() => updateC((x) => void (x.search.fields = on ? x.search.fields.filter((v) => v !== p.value) : [...x.search.fields, p.value]))}
                              className={cx("rounded-md px-2 py-1 font-mono text-[12px] ring-1 transition ring-inset", on ? "bg-[#f3f0fd] text-ion ring-ion/40" : "bg-card text-slate ring-neutral-200 hover:text-night")}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                    </div>
                  </FormField>
                </div>
              )}
            </div>
          </Panel>

          {/* Relations */}
          <Panel title="Related data" description="Computed from other collections that reference this one.">
            {backRefs.length === 0 ? (
              <p className="px-5 py-6 text-[14px] text-slate">No collection references {c.name} yet. Add a Reference field elsewhere to enable counts and related lists.</p>
            ) : (
              <div className="grid gap-6 p-5 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <p className="text-[13.5px] font-semibold text-night">Counts</p>
                  <p className="text-[13px] text-slate">Adds a number to every record, e.g. dish_count.</p>
                  {c.counts.map((n, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={n.key} onChange={(e) => updateC((x) => void (x.counts[i].key = e.target.value.toLowerCase()))} className={cx(inputCls, "font-mono text-[12.5px]")} aria-label="Count key" />
                      <select
                        value={`${n.collection}.${n.via}`}
                        onChange={(e) => updateC((x) => {
                          const [collection, via] = e.target.value.split(".");
                          x.counts[i] = { ...x.counts[i], collection, via };
                        })}
                        className={selectCls}
                        aria-label="Counted records"
                      >
                        {backRefs.map((b) => (
                          <option key={`${b.collection}.${b.via}`} value={`${b.collection}.${b.via}`}>
                            {b.collection} by {b.via}
                          </option>
                        ))}
                      </select>
                      <button type="button" className={iconBtn} aria-label="Remove count" onClick={() => updateC((x) => void x.counts.splice(i, 1))}>
                        <Trash01 className="size-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => updateC((x) => void x.counts.push({ key: `${backRefs[0].collection.replace(/-/g, "_")}_count`.slice(0, 40), ...backRefs[0] }))} className="flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-ion">
                    <Plus className="size-4" /> Add count
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-[13.5px] font-semibold text-night">Related lists in detail</p>
                  <p className="text-[13px] text-slate">Embeds the referencing records in GET /{c.slug}/{"{slug}"}.</p>
                  {c.detail.include.map((inc, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-lg bg-paper p-3">
                      <div className="flex gap-2">
                        <input value={inc.as} onChange={(e) => updateC((x) => void (x.detail.include[i].as = e.target.value.toLowerCase()))} className={cx(inputCls, "font-mono text-[12.5px]")} aria-label="Property name" />
                        <select
                          value={`${inc.collection}.${inc.via}`}
                          onChange={(e) => updateC((x) => {
                            const [collection, via] = e.target.value.split(".");
                            x.detail.include[i] = { ...x.detail.include[i], collection, via };
                          })}
                          className={selectCls}
                          aria-label="Related records"
                        >
                          {backRefs.map((b) => (
                            <option key={`${b.collection}.${b.via}`} value={`${b.collection}.${b.via}`}>
                              {b.collection} by {b.via}
                            </option>
                          ))}
                        </select>
                        <button type="button" className={iconBtn} aria-label="Remove related list" onClick={() => updateC((x) => void x.detail.include.splice(i, 1))}>
                          <Trash01 className="size-4" />
                        </button>
                      </div>
                      <Switch isSelected={inc.omitVia} onChange={(v) => updateC((x) => void (x.detail.include[i].omitVia = v))} label={`Leave out "${inc.via}"`} description="It would only repeat this record." />
                    </div>
                  ))}
                  {c.detail.include.length < 4 && (
                    <button type="button" onClick={() => updateC((x) => void x.detail.include.push({ ...backRefs[0], as: backRefs[0].collection.replace(/-/g, "_"), omitVia: true }))} className="flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-ion">
                      <Plus className="size-4" /> Add related list
                    </button>
                  )}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <FieldDrawer
        key={drawer.n}
        open={drawer.open}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
        initial={drawer.field}
        collection={c}
        collections={def.collections}
        live={Boolean(live)}
        onSave={(f) =>
          updateC((x) => {
            const at = drawer.field ? x.fields.findIndex((y) => y.key === drawer.field!.key) : -1;
            if (at >= 0) {
              const oldKey = x.fields[at].key;
              x.fields[at] = f;
              // Keep sorts, filters and search pointing at a renamed field.
              if (oldKey !== f.key) {
                for (const s of x.sort) if (s.field === oldKey) s.field = f.key;
                for (const fl of x.filters) if (fl.path === oldKey) fl.path = f.key;
                x.search.fields = x.search.fields.map((p) => (p === oldKey ? f.key : p));
              }
            } else x.fields.push(f);
          })
        }
      />

      {/* Save bar */}
      <div
        className={cx(
          "fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-card/95 shadow-[0_-8px_24px_rgba(15,18,32,0.08)] transition-transform duration-200",
          dirty || error || notice ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="container flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 text-[13.5px]">
            {error ? (
              <p className="text-[#a12b2b]">{error}</p>
            ) : problems.length ? (
              <p className="text-[#8a5a00]">
                <span className="font-semibold">{problems.length} problem{problems.length === 1 ? "" : "s"}:</span> {problems[0]}
              </p>
            ) : breaking.length ? (
              <p className="text-[#8a5a00]">
                <span className="font-semibold">Breaking for a live version:</span> {breaking[0]} Start v{version + 1} for this.
              </p>
            ) : dirty ? (
              <p className="text-ink-2">You have unsaved changes.</p>
            ) : (
              <p className="text-[#17663a]">{notice}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {dirty && (
              <Button size="sm" color="secondary" onPress={() => { setDef(saved); setError(null); }}>
                Discard
              </Button>
            )}
            {dirty ? (
              <Button size="sm" isLoading={busy} isDisabled={problems.length > 0 || breaking.length > 0} onPress={save}>
                Save schema
              </Button>
            ) : (
              <Button size="sm" color="secondary" onPress={() => { setNotice(null); setError(null); }}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
