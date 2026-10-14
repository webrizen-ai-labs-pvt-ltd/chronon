import { describe, expect, it } from "vitest";
import {
  buildCatalog,
  decodeCursor,
  dietSatisfies,
  encodeCursor,
  filterDishes,
  getCatalog,
  normalize,
  pickRandom,
} from "@/apis/menus/catalog";
import { regionFiles } from "@/apis/menus/data";
import { dishQuerySchema } from "@/apis/menus/schema";

describe("menus dataset", () => {
  it("every region file is valid and slugs are unique", () => {
    // buildCatalog validates with Zod and throws on duplicate slugs.
    const catalog = buildCatalog(regionFiles);
    expect(catalog.regions.length).toBe(regionFiles.length);
    expect(catalog.dishes.length).toBeGreaterThan(100);
  });

  it("file name matches the region slug", async () => {
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(new URL("../src/apis/menus/data", import.meta.url)).filter((f) => f.endsWith(".json"));
    const slugs = getCatalog().regions.map((r) => `${r.slug}.json`);
    expect(files.sort()).toEqual(slugs.sort());
  });

  it("rejects duplicate dish slugs across regions", () => {
    const [a, b] = regionFiles as { dishes: { slug: string }[] }[];
    const clash = { ...b, dishes: [{ ...b.dishes[0], slug: a.dishes[0].slug }] };
    expect(() => buildCatalog([a, clash])).toThrow(/Duplicate dish slug/);
  });

  it("rejects invalid data", () => {
    const [a] = regionFiles as Record<string, unknown>[];
    expect(() => buildCatalog([{ ...a, country_code: "India" }])).toThrow();
  });
});

describe("filters", () => {
  const catalog = getCatalog();

  it("filters by region, course and spice", () => {
    const res = filterDishes(catalog, { region: "kerala", course: "breakfast", max_spice: 0 });
    expect(res.length).toBeGreaterThan(0);
    for (const d of res) {
      expect(d.region.slug).toBe("kerala");
      expect(d.course).toBe("breakfast");
      expect(d.spice_level).toBe(0);
    }
  });

  it("diet means 'suitable for'", () => {
    expect(dietSatisfies("vegan", "vegetarian")).toBe(true);
    expect(dietSatisfies("eggetarian", "vegetarian")).toBe(false);
    expect(dietSatisfies("vegetarian", "pescatarian")).toBe(true);
    expect(dietSatisfies("pescatarian", "non_vegetarian")).toBe(false);
    const veg = filterDishes(catalog, { diet: "vegetarian" });
    expect(veg.some((d) => d.diet === "vegan")).toBe(true);
    expect(veg.every((d) => d.diet === "vegan" || d.diet === "vegetarian")).toBe(true);
  });

  it("search ignores case and accents, and covers ingredients", () => {
    expect(filterDishes(catalog, { q: "TIRAMISU" }).map((d) => d.slug)).toEqual(["tiramisu"]);
    expect(filterDishes(catalog, { q: "kokum" }).length).toBeGreaterThan(1);
    expect(normalize("Balchão")).toBe("balchao");
  });

  it("filters by country code", () => {
    const jp = filterDishes(catalog, { country: "JP" });
    expect(jp.length).toBeGreaterThan(0);
    expect(jp.every((d) => d.region.country_code === "JP")).toBe(true);
  });
});

describe("query parsing", () => {
  it("applies defaults and coerces numbers", () => {
    expect(dishQuerySchema.parse({ max_spice: "2", country: "in" })).toMatchObject({ limit: 20, max_spice: 2, country: "IN" });
  });

  it("rejects bad values", () => {
    expect(dishQuerySchema.safeParse({ diet: "carnivore" }).success).toBe(false);
    expect(dishQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(dishQuerySchema.safeParse({ region: "Not A Slug" }).success).toBe(false);
  });
});

describe("pagination & random", () => {
  it("round-trips cursors and rejects junk", () => {
    expect(decodeCursor(encodeCursor(40))).toBe(40);
    expect(decodeCursor(undefined)).toBe(0);
    expect(decodeCursor("garbage")).toBeNull();
  });

  it("picks without repeats", () => {
    const items = [1, 2, 3, 4, 5];
    const picked = pickRandom(items, 5);
    expect(new Set(picked).size).toBe(5);
    expect(pickRandom(items, 10)).toHaveLength(5);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});
