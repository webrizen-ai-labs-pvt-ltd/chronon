"use client";

import { SearchLg } from "@untitledui/icons";
import { useMemo, useState } from "react";
import type { Key } from "react-aria-components";
import { TabList, Tabs } from "@/components/application/tabs/tabs";
import { Input } from "@/components/base/input/input";
import { dietSatisfies, normalize } from "@/apis/menus/match";
import type { DishData } from "@/apis/menus/schema";
import { cx } from "@/utils/cx";

export type ExplorerDish = Pick<DishData, "slug" | "name" | "local_name" | "description" | "course" | "diet" | "spice_level"> & {
  region: string;
  country: string;
  search: string;
};

const DIETS = [
  { id: "any", label: "Any diet" },
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "pescatarian", label: "Pescatarian" },
] as const;

const SHOWN = 6;

function SpiceMeter({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`Spice level ${level} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={cx("size-1.5 rounded-full", i < level ? "bg-photon" : "bg-white/15")} />
      ))}
    </span>
  );
}

/**
 * Filters the real dataset in the browser and shows the matching /v1 request,
 * so visitors see exactly what the API would return before they sign up.
 */
export function Explorer({ dishes, countries }: { dishes: ExplorerDish[]; countries: { code: string; name: string }[] }) {
  const [country, setCountry] = useState<Key>("all");
  const [diet, setDiet] = useState<Key>("any");
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const needle = normalize(q.trim());
    return dishes.filter(
      (d) =>
        (country === "all" || d.country === country) &&
        (diet === "any" || dietSatisfies(d.diet, diet as DishData["diet"])) &&
        (!needle || d.search.includes(needle)),
    );
  }, [dishes, country, diet, q]);

  const params = new URLSearchParams();
  if (country !== "all") params.set("country", String(country));
  if (diet !== "any") params.set("diet", String(diet));
  if (q.trim()) params.set("q", q.trim());
  const query = params.toString();

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="glass flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="w-full shrink-0 md:w-[360px]">
            <Input
              aria-label="Search dishes"
              placeholder="Search: kokum, ramen, paneer…"
              icon={SearchLg}
              value={q}
              onChange={setQ}
              size="md"
              className="w-full"
            />
          </div>
          <Tabs selectedKey={diet} onSelectionChange={setDiet} className="min-w-0 md:ml-auto md:w-auto">
            <TabList type="button-minimal" size="sm" aria-label="Diet" className="flex-wrap" items={DIETS.map((d) => ({ ...d }))} />
          </Tabs>
        </div>
        <Tabs selectedKey={country} onSelectionChange={setCountry} className="min-w-0">
          <TabList
            type="button-minimal"
            size="sm"
            aria-label="Country"
            className="flex-wrap self-start"
            items={[{ id: "all", label: "All countries" }, ...countries.map((c) => ({ id: c.code, label: c.name }))]}
          />
        </Tabs>
      </div>

      {/* The equivalent request */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[12.5px]">
        <span className="break-all text-mist">
          <span className="text-photon">GET</span> <span className="text-paper">/v1/menus/dishes</span>
          {query && <span className="text-ion-soft">?{query}</span>}
        </span>
        <span className="text-comment">
          {matches.length} result{matches.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Results */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {matches.slice(0, SHOWN).map((d) => (
          <article
            key={d.slug}
            data-prism
            className="flex min-h-[210px] flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-white/15"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="label text-[11px] text-mist-2">
                {d.region} · {d.course}
              </span>
              <SpiceMeter level={d.spice_level} />
            </div>
            <div>
              <h3 className="text-[24px] leading-tight font-bold tracking-[-0.025em] text-paper">{d.name}</h3>
              {d.local_name && <p className="mt-0.5 text-[16px] text-mist-2">{d.local_name}</p>}
            </div>
            <p className="text-[16px] leading-normal text-mist">{d.description}</p>
            <div className="mt-auto flex flex-wrap gap-1.5 font-mono text-[11px] text-mist-2">
              <span className="rounded-full border border-white/10 px-2 py-0.5">{d.diet.replace("_", "-")}</span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">{d.slug}</span>
            </div>
          </article>
        ))}
        {matches.length === 0 && (
          <div className="col-span-full flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <p className="text-[22px] font-bold tracking-[-0.02em] text-paper">Nothing matches that.</p>
            <p className="text-[16px] text-mist-2">The API would answer with an empty list. Try fewer filters.</p>
          </div>
        )}
      </div>
      {matches.length > SHOWN && (
        <p className="px-1 text-center text-[15px] text-mist-2">
          + {matches.length - SHOWN} more in the full response, paged with <code className="font-mono text-[13px]">cursor</code>.
        </p>
      )}
    </div>
  );
}
