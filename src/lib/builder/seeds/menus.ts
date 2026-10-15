import { COURSES, DIETS, REGION_KINDS, regionFileSchema } from "@/apis/menus/schema";
import { datasetDefinitionSchema, type DatasetDefinition } from "../definition";
import type { DatasetData } from "../engine";

/**
 * Regional menus expressed as a builder definition. Used to seed the database
 * (the first builder API) and by the parity tests that prove the engine serves
 * exactly what the hand-written routes did.
 */
export const menusDefinition: DatasetDefinition = datasetDefinitionSchema.parse({
  kind: "dataset",
  randomAlias: "dishes",
  collections: [
    {
      slug: "regions",
      name: "Regions",
      description: "Countries, states and cities with a distinct cuisine.",
      fields: [
        { key: "name", label: "Name", type: "text", required: true, maxLength: 80 },
        { key: "kind", label: "Kind", type: "enum", required: true, values: [...REGION_KINDS] },
        { key: "country_code", label: "Country code", type: "text", required: true, pattern: "^[A-Z]{2}$", description: "ISO 3166-1 alpha-2" },
        { key: "country", label: "Country", type: "text", required: true, maxLength: 80 },
        { key: "summary", label: "Summary", type: "longtext", required: true, maxLength: 200 },
        { key: "staples", label: "Staples", type: "list", itemType: "text", required: true },
      ],
      sort: [
        { field: "country", dir: "asc" },
        { field: "name", dir: "asc" },
      ],
      list: { enabled: true, paginate: false, defaultLimit: 20, maxLimit: 100 },
      detail: { enabled: true, include: [{ collection: "dishes", via: "region", as: "dishes", omitVia: true }] },
      filters: [{ param: "country", path: "country_code", caseInsensitive: true, description: "2-letter country code" }],
      counts: [{ key: "dish_count", collection: "dishes", via: "region" }],
    },
    {
      slug: "dishes",
      name: "Dishes",
      description: "Dishes with course, diet, spice and price levels.",
      fields: [
        { key: "name", label: "Name", type: "text", required: true, maxLength: 80 },
        { key: "local_name", label: "Local name", type: "text", maxLength: 80 },
        { key: "description", label: "Description", type: "longtext", required: true, maxLength: 200 },
        { key: "course", label: "Course", type: "enum", required: true, values: [...COURSES] },
        { key: "diet", label: "Diet", type: "enum", required: true, values: [...DIETS] },
        { key: "spice_level", label: "Spice level", type: "integer", required: true, min: 0, max: 5 },
        { key: "price_level", label: "Price level", type: "integer", required: true, min: 1, max: 3 },
        { key: "ingredients", label: "Ingredients", type: "list", itemType: "text", required: true },
        { key: "tags", label: "Tags", type: "list", itemType: "text" },
        { key: "region", label: "Region", type: "reference", required: true, target: "regions", embed: ["slug", "name", "country_code"] },
      ],
      sort: [{ field: "name", dir: "asc" }],
      random: { enabled: true, maxCount: 10 },
      filters: [
        { param: "region", path: "region" },
        { param: "country", path: "region.country_code", caseInsensitive: true },
        { param: "course", path: "course" },
        {
          param: "diet",
          path: "diet",
          description: "Dishes suitable for this diet.",
          implies: {
            vegan: ["vegan"],
            vegetarian: ["vegan", "vegetarian"],
            eggetarian: ["vegan", "vegetarian", "eggetarian"],
            pescatarian: ["vegan", "vegetarian", "eggetarian", "pescatarian"],
            non_vegetarian: ["non_vegetarian"],
          },
        },
        { param: "max_spice", path: "spice_level", op: "lte" },
      ],
      search: { enabled: true, param: "q", fields: ["name", "local_name", "region.name", "ingredients", "tags"] },
    },
  ],
});

/** Converts the legacy region files (one JSON per region) into builder records. */
export function menusRecords(files: unknown[]): DatasetData {
  const regions: DatasetData[string] = [];
  const dishes: DatasetData[string] = [];
  for (const raw of files) {
    const { slug, dishes: list, ...region } = regionFileSchema.parse(raw);
    regions.push({ slug, data: region });
    for (const { slug: dishSlug, ...dish } of list) dishes.push({ slug: dishSlug, data: { ...dish, region: slug } });
  }
  return { regions, dishes };
}
