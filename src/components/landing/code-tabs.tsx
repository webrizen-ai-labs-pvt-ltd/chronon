"use client";

import { TabList, TabPanel, Tabs } from "@/components/application/tabs/tabs";
import { CopyButton } from "@/components/copy-button";
import { Highlight } from "./highlight";

export type CodeSample = { id: string; label: string; code: string };

/** Language tabs over a Night code panel, with a copy button per sample. */
export function CodeTabs({ samples, response }: { samples: CodeSample[]; response: string }) {
  return (
    <div className="glass dark-mode flex min-w-0 flex-col overflow-hidden text-left">
      <Tabs className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5">
          <span className="flex gap-1.5 pl-1" aria-hidden>
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </span>
          <TabList size="sm" type="button-minimal" aria-label="Language" items={samples.map((s) => ({ id: s.id, label: s.label }))} />
          <span className="w-[46px]" aria-hidden />
        </div>
        {samples.map((s) => (
          <TabPanel key={s.id} id={s.id} className="relative">
            <CopyButton text={s.code} className="absolute top-2.5 right-3 z-10" />
            <pre className="px-5 pt-11 pb-4 font-mono text-[13px] leading-[1.9] break-all whitespace-pre-wrap text-mist">
              <code>
                <Highlight code={s.code} />
              </code>
            </pre>
          </TabPanel>
        ))}
      </Tabs>
      <div className="border-t border-white/8 bg-black/15">
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="label text-[11px] text-mist-2">Response · 200 OK</span>
          <span className="font-mono text-[11px] text-comment">application/json</span>
        </div>
        <pre className="overflow-x-auto px-5 pt-1 pb-4 font-mono text-[13px] leading-[1.9] text-mist">
          <code>
            <Highlight code={response} />
          </code>
        </pre>
      </div>
    </div>
  );
}
