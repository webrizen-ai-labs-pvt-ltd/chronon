"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/admin/interactive";
import { Alert, Card, inputCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import type { BlockSetting } from "@/lib/builder/blocks";
import type { BlockDefinition } from "@/lib/builder/definition";
import { cx } from "@/utils/cx";
import { saveDefinitionAction } from "../../../actions";

/** Settings form generated from the block's declared settings. */
export function BlockSettingsForm({
  slug,
  version,
  blockName,
  blockSummary,
  settings,
  initial,
  definition,
  readOnly,
}: {
  slug: string;
  version: number;
  blockName: string;
  blockSummary: string;
  settings: BlockSetting[];
  initial: Record<string, unknown>;
  definition: BlockDefinition;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(settings.map((s) => [s.key, initial[s.key] ?? s.default])));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(Object.fromEntries(settings.map((s) => [s.key, initial[s.key] ?? s.default])));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card title="Settings" description="Limits and defaults for this API. Changes reach live traffic within 15 seconds.">
        <form
          className="flex flex-col gap-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await saveDefinitionAction(slug, version, { ...definition, config: values });
            setBusy(false);
            setResult(res.ok ? { ok: true, message: "Settings saved." } : { ok: false, message: res.error });
            if (res.ok) router.refresh();
          }}
        >
          <fieldset disabled={readOnly} className="grid gap-5 sm:grid-cols-2">
            {settings.map((s) => (
              <Field key={s.key} label={s.label} hint={s.help} htmlFor={`s-${s.key}`} className={s.type === "multi" ? "sm:col-span-2" : undefined}>
                {s.type === "integer" ? (
                  <input
                    id={`s-${s.key}`}
                    type="number"
                    min={s.min}
                    max={s.max}
                    value={Number(values[s.key])}
                    onChange={(e) => setValues((v) => ({ ...v, [s.key]: Math.max(s.min, Math.min(s.max, Number(e.target.value) || s.min)) }))}
                    className={inputCls}
                  />
                ) : s.type === "text" ? (
                  <input id={`s-${s.key}`} value={String(values[s.key] ?? "")} maxLength={s.maxLength} onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))} className={inputCls} />
                ) : (
                  <div id={`s-${s.key}`} className="flex flex-wrap gap-2">
                    {s.options.map((o) => {
                      const list = (values[s.key] as string[]) ?? [];
                      const on = list.includes(o);
                      return (
                        <button
                          key={o}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setValues((v) => ({ ...v, [s.key]: on ? list.filter((x) => x !== o) : [...list, o] }))}
                          className={cx("rounded-md px-2.5 py-1 font-mono text-[12.5px] ring-1 transition ring-inset", on ? "bg-[#f3f0fd] text-ion ring-ion/40" : "bg-card text-slate ring-neutral-200 hover:text-night")}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Field>
            ))}
          </fieldset>
          {result && <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert>}
          {!readOnly && (
            <div className="flex gap-2 border-t border-neutral-200 pt-5">
              <Button type="submit" size="sm" isDisabled={!dirty} isLoading={busy}>
                Save settings
              </Button>
              {dirty && (
                <Button size="sm" color="secondary" onPress={() => setValues(Object.fromEntries(settings.map((s) => [s.key, initial[s.key] ?? s.default])))}>
                  Discard
                </Button>
              )}
            </div>
          )}
        </form>
      </Card>
      <Card title={blockName}>
        <p className="text-[14px] leading-relaxed text-ink-2">{blockSummary}</p>
        <p className="mt-3 text-[13px] text-slate">Blocks only compute from the request: they never fetch URLs or store what callers send.</p>
      </Card>
    </div>
  );
}
