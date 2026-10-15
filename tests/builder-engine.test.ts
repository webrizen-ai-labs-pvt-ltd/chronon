import { describe, expect, it } from "vitest";
import { filterDishes, getCatalog } from "@/apis/menus/catalog";
import { regionFiles } from "@/apis/menus/data";
import { checkDataset, datasetDefinitionSchema } from "@/lib/builder/definition";
import { decodeCursor, encodeCursor, handleDataset, prepare, type EngineResult } from "@/lib/builder/engine";
import { menusDefinition, menusRecords } from "@/lib/builder/seeds/menus";

const prepared = prepare(menusDefinition, menusRecords(regionFiles));
const catalog = getCatalog();

function get(path: string, query: Record<string, string | undefined> = {}): EngineResult {
  const segments = path.split("/").filter(Boolean);
  const params = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => e[1] !== undefined));
  return handleDataset(prepared, segments, params, "/v1/menus");
}
const body = (r: EngineResult) => {
  if (!("body" in r)) throw new Error(`expected a body, got ${r.status} ${r.error.message}`);
  return r.body as Record<string, unknown>;
};
/** JSON round-trip, as the client sees it. */
const wire = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("menus definition", () => {
  it("is valid", () => {
    expect(checkDataset(menusDefinition)).toEqual([]);
  });

  it("flags broken references", () => {
    const broken = datasetDefinitionSchema.parse({
      kind: "dataset",
      collections: [
        {
          slug: "a",
          name: "A",
          fields: [{ key: "b", label: "B", type: "reference", target: "nope" }],
          filters: [{ param: "x", path: "missing" }],
        },
      ],
    });
    const problems = checkDataset(broken);
    expect(problems.some((p) => p.includes('"nope"'))).toBe(true);
    expect(problems.some((p) => p.includes('"missing"'))).toBe(true);
  });
});

describe("engine parity with the legacy menus routes", () => {
  it("regions list", () => {
    expect(wire(body(get("regions")))).toEqual(wire({ data: catalog.regions, total: catalog.regions.length }));
    const jp = catalog.regions.filter((r) => r.country_code === "JP");
    expect(wire(body(get("regions", { country: "jp" })))).toEqual(wire({ data: jp, total: jp.length }));
  });

  it("region detail with its dishes", () => {
    for (const region of catalog.regions) {
      const dishes = catalog.dishes.filter((d) => d.region.slug === region.slug).map(({ region: _r, ...d }) => d);
      expect(wire(body(get(`regions/${region.slug}`)))).toEqual(wire({ data: { ...region, dishes } }));
    }
  });

  it("dish detail", () => {
    for (const dish of catalog.dishes) expect(wire(body(get(`dishes/${dish.slug}`)))).toEqual(wire({ data: dish }));
  });

  it.each([
    {},
    { region: "kerala" },
    { country: "in" },
    { course: "dessert" },
    { diet: "vegetarian" },
    { diet: "pescatarian", max_spice: "2" },
    { q: "TIRAMISU" },
    { q: "kokum" },
    { q: "goa" },
    { region: "kerala", course: "breakfast", max_spice: "0" },
  ])("dishes list %o", (query) => {
    const legacy = filterDishes(catalog, {
      region: query.region,
      country: query.country?.toUpperCase(),
      course: query.course as never,
      diet: query.diet as never,
      max_spice: query.max_spice === undefined ? undefined : Number(query.max_spice),
      q: query.q,
    });
    const res = body(get("dishes", query));
    expect(res.total).toBe(legacy.length);
    expect(wire(res.data)).toEqual(wire(legacy.slice(0, 20)));
    expect(res.next_cursor).toBe(legacy.length > 20 ? encodeCursor(20) : null);
  });

  it("paginates with cursors", () => {
    const all: unknown[] = [];
    let cursor: string | null = null;
    do {
      const res = body(get("dishes", cursor ? { limit: "50", cursor } : { limit: "50" }));
      all.push(...(res.data as unknown[]));
      cursor = res.next_cursor as string | null;
    } while (cursor);
    expect(wire(all)).toEqual(wire(catalog.dishes));
    expect(decodeCursor(encodeCursor(40))).toBe(40);
  });

  it("random respects filters and count", () => {
    for (const path of ["random", "dishes/random"]) {
      const res = body(get(path, { count: "5", diet: "vegan" }));
      const data = res.data as { diet: string; slug: string }[];
      expect(data).toHaveLength(5);
      expect(new Set(data.map((d) => d.slug)).size).toBe(5);
      expect(data.every((d) => d.diet === "vegan")).toBe(true);
    }
  });

  it("rejects bad input like the legacy routes", () => {
    for (const query of [{ diet: "carnivore" }, { limit: "500" }, { region: "Not A Slug" }, { max_spice: "9" }, { country: "India" }, { cursor: "garbage" }]) {
      expect(get("dishes", query).status, JSON.stringify(query)).toBe(400);
    }
    expect(get("random", { count: "11" }).status).toBe(400);
  });

  it("404s", () => {
    expect(get("dishes/nope").status).toBe(404);
    expect(get("regions/nope").status).toBe(404);
    expect(get("nope").status).toBe(404);
    expect(get("random", { region: "kerala", course: "beverage", diet: "vegan", max_spice: "0", q: "zzzz" }).status).toBe(404);
    expect(get("regions/random").status).toBe(404);
  });

  it("indexes its collections", () => {
    const res = body(get(""));
    expect(wire(res.collections)).toMatchObject([
      { slug: "regions", endpoints: ["/v1/menus/regions", "/v1/menus/regions/{slug}"] },
      { slug: "dishes", endpoints: ["/v1/menus/dishes", "/v1/menus/dishes/{slug}", "/v1/menus/dishes/random"] },
    ]);
  });
});
