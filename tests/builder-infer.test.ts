import { describe, expect, it } from "vitest";
import { handleDataset, prepare } from "@/lib/builder/engine";
import { buildFromPlan, detectHeaderRow, importOrder, planWorkbook, type RawSheet } from "@/lib/builder/infer";
import { validateRecord } from "@/lib/builder/records";

const regions: RawSheet = {
  name: "Regions",
  rows: [
    ["Name", "Country", "Code"],
    ["Kerala", "India", "IN"],
    ["Goa", "India", "IN"],
    ["Tōkyō", "Japan", "JP"],
  ],
};

const dishes: RawSheet = {
  name: "Dishes",
  rows: [
    ["Menu export, October", null, null], // a title row above the header
    ["Name", "Region", "Course", "Spice", "Price", "Vegetarian", "Ingredients", "Added", "Link", "Notes"],
    ["Appam", "Kerala", "breakfast", 0, 1.5, "yes", "rice, coconut, yeast", new Date(Date.UTC(2026, 0, 2)), "https://example.com/appam", null],
    ["Puttu", "kerala", "breakfast", 1, 2, "yes", "rice, coconut", new Date(Date.UTC(2026, 0, 3)), "https://example.com/puttu", null],
    ["Fish Curry", "Goa", "main", 3, 4.25, "no", "fish, kokum, coconut", new Date(Date.UTC(2026, 0, 4)), "https://example.com/fish", "Very\nspicy"],
    ["Vindaloo", "Goa", "main", 5, 5, "no", "pork, vinegar, chillies", new Date(Date.UTC(2026, 0, 5)), "https://example.com/vindaloo", null],
    ["Ramen", "Tokyo", "main", 2, "n/a", "no", "noodles, broth", new Date(Date.UTC(2026, 0, 6)), "https://example.com/ramen", null],
    ["Mochi", "Tōkyō", "dessert", 0, 3, "yes", "rice, sugar", new Date(Date.UTC(2026, 0, 7)), "https://example.com/mochi", null],
    [null, null, null, null, null, null, null, null, null, null], // blank row
    ["Appam", "Kerala", "breakfast", 0, 1.5, "yes", "rice, coconut", null, null, null], // duplicate name
  ],
};

describe("spreadsheet inference", () => {
  const plan = planWorkbook([regions, dishes]);
  const [r, d] = plan.sheets;
  const col = (key: string) => d.columns.find((c) => c.key === key)!;

  it("finds the header row under a title", () => {
    expect(detectHeaderRow(dishes.rows)).toBe(1);
    expect(d.headerRow).toBe(1);
    expect(d.rowCount).toBe(7);
  });

  it("guesses column types", () => {
    expect(col("name").type).toBe("text");
    expect(col("course")).toMatchObject({ type: "enum", values: ["breakfast", "dessert", "main"] });
    expect(col("spice").type).toBe("integer");
    expect(col("price").type).toBe("number");
    expect(col("vegetarian").type).toBe("boolean");
    expect(col("ingredients")).toMatchObject({ type: "list", separator: "," });
    expect(col("added").type).toBe("date");
    expect(col("link").type).toBe("url");
    expect(col("notes").type).toBe("longtext");
  });

  it("links sheets by name, ignoring case and accents", () => {
    expect(col("region")).toMatchObject({ type: "reference", targetSheet: "Regions" });
    expect(r.id).toEqual({ kind: "name", index: 0 });
  });

  it("builds a valid API with records the server will accept", () => {
    const res = buildFromPlan(plan, [regions, dishes]);
    expect(res.problems).toEqual([]);
    const def = res.definition!;
    expect(importOrder(def)).toEqual(["regions", "dishes"]);
    expect(res.data.dishes.map((x) => x.slug)).toEqual(["appam", "puttu", "fish-curry", "vindaloo", "ramen", "mochi", "appam-2"]);
    expect(res.data.regions.map((x) => x.slug)).toEqual(["kerala", "goa", "tokyo"]);
    // "n/a" counts as empty, so price isn't required but nothing is invalid.
    expect(res.invalid.Dishes).toEqual({});
    expect(def.collections[1].fields.find((f) => f.key === "price")?.required).toBe(false);

    const slugs = new Map(Object.entries(res.data).map(([k, rows]) => [k, new Set(rows.map((x) => x.slug))]));
    for (const c of def.collections) {
      for (const rec of res.data[c.slug]) {
        expect(validateRecord(c, rec, (col, s) => slugs.get(col)?.has(s) ?? false)).toMatchObject({ ok: true });
      }
    }

    // The API response, exactly as the engine will serve it.
    const p = prepare(def, Object.fromEntries(Object.entries(res.data).map(([k, rows]) => [k, rows.map((x) => ({ slug: String(x.slug), data: x.data }))])));
    const ramen = handleDataset(p, ["dishes", "ramen"], new URLSearchParams(), "/v1/x");
    expect(ramen).toMatchObject({ status: 200, body: { data: { region: { slug: "tokyo", name: "Tōkyō" }, price: null, ingredients: ["noodles", "broth"] } } });
    const tokyo = handleDataset(p, ["regions", "tokyo"], new URLSearchParams(), "/v1/x");
    expect(tokyo).toMatchObject({ status: 200, body: { data: { dishes_count: 2, dishes: [{ slug: "mochi" }, { slug: "ramen" }] } } });
    const viaLink = handleDataset(p, ["dishes"], new URLSearchParams({ q: "tokyo" }), "/v1/x");
    expect(viaLink).toMatchObject({ status: 200, body: { total: 2 } });
    const mains = handleDataset(p, ["dishes"], new URLSearchParams({ course: "MAIN" }), "/v1/x");
    expect(mains).toMatchObject({ status: 200, body: { total: 3 } });
  });

  it("reports cells that don't fit a type the admin picked", () => {
    const changed = structuredClone(plan);
    changed.sheets[1].columns.find((c) => c.key === "name")!.type = "integer";
    const res = buildFromPlan(changed, [regions, dishes]);
    expect(res.invalid.Dishes.name).toBe(7);
    expect(res.issues[0]).toMatchObject({ sheet: "Dishes", row: 3, column: "Name" });
  });

  it("uses an id column when there is one", () => {
    const sheet: RawSheet = { name: "Planets", rows: [["ID", "Name"], ["p1", "Earth"], ["p2", "Mars"]] };
    const [p] = planWorkbook([sheet]).sheets;
    expect(p.id).toEqual({ kind: "column", index: 0 });
    expect(p.columns.find((c) => c.header === "ID")?.include).toBe(false);
  });
});

describe("importing a spreadsheet into an existing collection", async () => {
  const { menusDefinition } = await import("@/lib/builder/seeds/menus");
  const dishes = menusDefinition.collections.find((c) => c.slug === "dishes")!;

  it("matches columns by label, slugs names, and splits lists", async () => {
    const { mapSheet } = await import("@/lib/builder/infer");
    const sheet: RawSheet = {
      name: "Dishes",
      rows: [
        ["Name", "Local name", "Description", "Course", "Diet", "Spice level", "Price level", "Ingredients", "Tags", "Region", "Calories"],
        ["Kerala Parotta", null, "Flaky layered flatbread from Kerala.", "bread", "vegetarian", 0, 1, "maida; oil", "street food", "Kerala", 300],
      ],
    };
    const res = mapSheet(dishes, sheet, "x.xlsx");
    expect(res.missing).toEqual([]);
    expect(res.unknown).toEqual(["Calories"]);
    expect(res.note).toMatch(/slugs are made from/);
    const row = res.rows[0];
    expect(row.slug).toBe("kerala-parotta");
    expect(row.data).toMatchObject({ spice_level: 0, price_level: 1, ingredients: ["maida", "oil"], tags: ["street food"], region: "kerala", local_name: null });
    expect(validateRecord(dishes, row, () => true)).toMatchObject({ ok: true });
  });
});
