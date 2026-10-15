"use client";

import { navigate } from "@/components/admin/nav-progress";
import { SlashCircle01, Trash01 } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton, Field } from "@/components/admin/interactive";
import { Alert, Card, inputCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { deleteApiAction, setApiStatusAction, updateMetaAction } from "../../../actions";

export function ApiSettings({ slug, name, summary, status }: { slug: string; name: string; summary: string; status: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name, summary });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const dirty = form.name !== name || form.summary !== summary;
  const disabled = status === "disabled";

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <Card title="General" description="How this API is listed in the docs and the /v1 index.">
        <form
          className="flex flex-col gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await updateMetaAction(slug, form.name, form.summary);
            setBusy(false);
            setResult(res.ok ? { ok: true, message: "Saved." } : { ok: false, message: res.error });
            if (res.ok) router.refresh();
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" required htmlFor="s-name">
              <input id="s-name" value={form.name} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Slug" htmlFor="s-slug" hint="Part of every URL, so it can't change.">
              <input id="s-slug" value={slug} disabled className={cx(inputCls, "font-mono text-[12.5px]")} />
            </Field>
            <Field label="Summary" htmlFor="s-summary" className="sm:col-span-2">
              <textarea id="s-summary" value={form.summary} maxLength={200} rows={2} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} className={cx(inputCls, "resize-none")} />
            </Field>
          </div>
          {result && <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert>}
          <div>
            <Button type="submit" size="sm" isDisabled={!dirty || !form.name.trim()} isLoading={busy}>
              Save
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Availability">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-semibold text-night">{disabled ? "This API is disabled" : "This API is serving traffic"}</p>
            <p className="text-[13.5px] text-slate">
              {disabled
                ? "Every version answers 404. Enable it to serve published versions again."
                : "Disabling makes every version answer 404 immediately, without changing versions or data. Use it to pull an API in an emergency."}
            </p>
          </div>
          <ConfirmButton
            label={disabled ? "Enable API" : "Disable API"}
            tone={disabled ? "default" : "danger"}
            iconLeading={disabled ? undefined : <SlashCircle01 data-icon="leading" />}
            title={disabled ? `Enable ${name}?` : `Disable ${name}?`}
            body={<p>{disabled ? "Published and deprecated versions start serving again within 15 seconds." : "Callers get 404 on every version within 15 seconds."}</p>}
            confirmLabel={disabled ? "Enable" : "Disable"}
            onConfirm={async () => {
              const res = await setApiStatusAction(slug, disabled ? "active" : "disabled");
              if (res.ok) router.refresh();
              return res;
            }}
          />
        </div>
      </Card>

      <Card title="Danger zone" className="border-[#f3c4c4]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-[14px] font-semibold text-night">Delete this API</p>
            <p className="text-[13.5px] text-slate">Removes every version and record permanently. The audit log keeps a record that it existed.</p>
          </div>
          <ConfirmButton
            label="Delete API"
            tone="danger"
            iconLeading={<Trash01 data-icon="leading" />}
            title={`Delete ${name}?`}
            body={<p>All versions, schemas and records are deleted and every URL starts answering 404. This can&apos;t be undone.</p>}
            confirmLabel="Delete permanently"
            confirmText={slug}
            onConfirm={async (typed) => {
              const res = await deleteApiAction(slug, typed);
              if (res.ok) navigate(router, "/dashboard/admin/apis");
              return res;
            }}
          />
        </div>
      </Card>
    </div>
  );
}
