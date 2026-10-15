"use client";

import { Play, Plus, Trash01 } from "@untitledui/icons";
import { useState } from "react";
import { Alert, inputCls, selectCls } from "@/components/admin/kit";
import { Button } from "@/components/base/buttons/button";
import { CopyButton } from "@/components/copy-button";
import { Highlight } from "@/components/landing/highlight";
import type { EndpointDoc } from "@/lib/builder/describe";
import { cx } from "@/utils/cx";
import { runPlaygroundAction, type PlaygroundResult } from "../../../actions";

type Param = { key: string; value: string; on: boolean };

function paramsFor(e: EndpointDoc | undefined, example?: Record<string, string>): Param[] {
  if (!e) return [];
  if (e.kind === "block" && example) return Object.entries(example).map(([key, value]) => ({ key, value, on: true }));
  return e.params.filter((p) => p.name !== "cursor").map((p) => ({ key: p.name, value: p.example ?? p.enum?.[0] ?? "", on: p.required }));
}

/** Calls any version (drafts too) as the API would, without a key or rate limits. */
export function Playground({
  slug,
  version,
  state,
  endpoints,
  blockExample,
  origin,
}: {
  slug: string;
  version: number;
  state: string;
  endpoints: EndpointDoc[];
  blockExample?: Record<string, string>;
  origin: string;
}) {
  const base = `/v${version}/${slug}`;
  const [endpoint, setEndpoint] = useState(endpoints[0]?.id ?? "");
  const current = endpoints.find((e) => e.id === endpoint);
  const [path, setPath] = useState(() => (current ? current.path.slice(base.length).replace(/^\//, "") : ""));
  const [params, setParams] = useState<Param[]>(() => paramsFor(current, blockExample));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = new URLSearchParams(params.filter((p) => p.on && p.key).map((p) => [p.key, p.value])).toString();
  const url = `${origin}${base}${path ? `/${path}` : ""}${query ? `?${query}` : ""}`;
  const curl = `curl "${url}" -H "Authorization: Bearer $CHRONON_KEY"`;
  const needsSlug = path.includes("{slug}");
  const setParam = (i: number, patch: Partial<Param>) => setParams((ps) => ps.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function send() {
    setBusy(true);
    setError(null);
    try {
      setRes(await runPlaygroundAction(slug, version, path, query));
    } catch {
      setError("The request failed. Check the server logs.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {state === "draft" && <Alert tone="info">You&apos;re calling the draft. Real API keys can&apos;t reach it until it&apos;s published.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-neutral-200 bg-card p-5 shadow-xs">
          <h2 className="text-[16px] font-bold text-night">Request</h2>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold text-night">Endpoint</span>
            <select
              value={endpoint}
              onChange={(e) => {
                const next = endpoints.find((x) => x.id === e.target.value);
                setEndpoint(e.target.value);
                setPath(next ? next.path.slice(base.length).replace(/^\//, "") : "");
                setParams(paramsFor(next, blockExample));
                setRes(null);
              }}
              className={selectCls}
            >
              {endpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  GET {e.path}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold text-night">Path</span>
            <div className="flex items-stretch overflow-hidden rounded-lg shadow-xs ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand">
              <span className="flex items-center border-r border-neutral-200 bg-paper px-3 font-mono text-[12.5px] whitespace-nowrap text-slate">{base}/</span>
              <input value={path} onChange={(e) => setPath(e.target.value)} className="min-w-0 flex-1 bg-primary px-3 py-2 font-mono text-[13px] text-primary outline-none" spellCheck={false} />
            </div>
            {needsSlug && <span className="text-[12.5px] text-[#8a5a00]">Replace {"{slug}"} with a record&apos;s slug.</span>}
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[13.5px] font-semibold text-night">Query parameters</span>
            {params.map((p, i) => {
              const doc = current?.params.find((x) => x.name === p.key);
              return (
                <div key={i} className="flex items-center gap-2">
                  <input type="checkbox" checked={p.on} onChange={() => setParam(i, { on: !p.on })} aria-label={`Send ${p.key}`} className="size-4 shrink-0 accent-[#5b45c9]" />
                  <input value={p.key} onChange={(e) => setParam(i, { key: e.target.value })} className={cx(inputCls, "w-[38%] font-mono text-[12.5px]")} aria-label="Name" />
                  {doc?.enum ? (
                    <select value={p.value} onChange={(e) => setParam(i, { value: e.target.value, on: true })} className={selectCls} aria-label={`${p.key} value`}>
                      {doc.enum.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={p.value} onChange={(e) => setParam(i, { value: e.target.value, on: true })} placeholder={doc?.type} className={cx(inputCls, "font-mono text-[12.5px]")} aria-label={`${p.key} value`} />
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${p.key}`}
                    onClick={() => setParams((ps) => ps.filter((_, j) => j !== i))}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-slate hover:bg-neutral-100 hover:text-night"
                  >
                    <Trash01 className="size-4" />
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={() => setParams((ps) => [...ps, { key: "", value: "", on: true }])} className="flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-ion">
              <Plus className="size-4" /> Add parameter
            </button>
          </div>

          <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5">
            <Button size="md" color="secondary" className="self-start" iconLeading={<Play data-icon="leading" />} onPress={send} isLoading={busy} isDisabled={needsSlug}>
              Send request
            </Button>
            <div className="relative rounded-lg bg-night px-4 py-3 pr-24">
              <code className="block font-mono text-[12px] leading-relaxed break-all text-mist">
                <Highlight code={curl} />
              </code>
              <CopyButton text={curl} className="absolute top-2.5 right-3" />
            </div>
          </div>
        </section>

        <section className="dark-mode flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-line-dark bg-night shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3">
            <span className="label text-[11px] text-mist-2">Response</span>
            {res && (
              <span className="flex items-center gap-3 font-mono text-[12px]">
                <span
                  className={cx(
                    "rounded px-1.5 py-0.5 font-semibold",
                    res.status < 300 ? "bg-[#17663a]/30 text-[#7fe0a6]" : res.status < 500 ? "bg-[#8a5a00]/30 text-[#f5c86b]" : "bg-[#a12b2b]/30 text-[#f3a0a0]",
                  )}
                >
                  {res.status}
                </span>
                <span className="text-mist-2">{res.ms} ms</span>
                <span className="text-comment">{res.contentType.split(";")[0]}</span>
              </span>
            )}
          </div>
          {error && <p className="px-5 py-4 text-[13.5px] text-[#f3a0a0]">{error}</p>}
          {!res && !error && <p className="m-auto px-6 text-center text-[14px] text-mist-2">Send a request to see the response.</p>}
          {res && res.contentType.startsWith("image/svg") && (
            <div className="grid place-items-center border-b border-white/8 bg-white p-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- inline preview of the SVG the API returned */}
              <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(res.body)}`} alt="Response preview" className="max-h-[260px] max-w-full" />
            </div>
          )}
          {res && (
            <pre className="max-h-[640px] flex-1 overflow-auto px-5 py-4 font-mono text-[12.5px] leading-[1.75] text-mist" data-lenis-prevent>
              <code>{res.contentType.includes("json") ? <Highlight code={res.body} /> : res.body}</code>
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}
