import { regionFiles } from "./data";
import { dietSatisfies, normalize } from "./match";
import { regionFileSchema, type DishData, type DishQuery, type RegionFile } from "./schema";

export { dietSatisfies, normalize };

export type RegionRef = { slug: string; name: string; country_code: string };
export type Dish = DishData & { region: RegionRef };
export type Region = Omit<RegionFile, "dishes"> & { dish_count: number };

export type Catalog = {
  regions: Region[];
  dishes: Dish[];
  regionBySlug: Map<string, Region>;
  dishBySlug: Map<string, Dish>;
};

/** Validates the raw files and indexes them. Throws on invalid or duplicate data. */
export function buildCatalog(files: unknown[]): Catalog {
  const regions: Region[] = [];
  const dishes: Dish[] = [];
  const regionBySlug = new Map<string, Region>();
  const dishBySlug = new Map<string, Dish>();

  for (const raw of files) {
    const file = regionFileSchema.parse(raw);
    if (regionBySlug.has(file.slug)) throw new Error(`Duplicate region slug: ${file.slug}`);
    const { dishes: regionDishes, ...meta } = file;
    const region: Region = { ...meta, dish_count: regionDishes.length };
    regions.push(region);
    regionBySlug.set(region.slug, region);

    const ref: RegionRef = { slug: region.slug, name: region.name, country_code: region.country_code };
    for (const d of regionDishes) {
      if (dishBySlug.has(d.slug)) throw new Error(`Duplicate dish slug: ${d.slug} (in ${region.slug})`);
      const dish: Dish = { ...d, region: ref };
      dishes.push(dish);
      dishBySlug.set(dish.slug, dish);
    }
  }

  regions.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  dishes.sort((a, b) => a.name.localeCompare(b.name));
  return { regions, dishes, regionBySlug, dishBySlug };
}

let cached: Catalog | undefined;
export function getCatalog() {
  cached ??= buildCatalog(regionFiles);
  return cached;
}

export function encodeCursor(offset: number) {
  return Buffer.from(`o:${offset}`).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): number | null {
  if (!cursor) return 0;
  const m = Buffer.from(cursor, "base64url").toString().match(/^o:(\d{1,6})$/);
  return m ? Number(m[1]) : null;
}

type DishFilter = Omit<DishQuery, "limit" | "cursor">;

export function filterDishes(catalog: Catalog, f: DishFilter): Dish[] {
  const q = f.q ? normalize(f.q) : null;
  return catalog.dishes.filter((d) => {
    if (f.region && d.region.slug !== f.region) return false;
    if (f.country && d.region.country_code !== f.country) return false;
    if (f.course && d.course !== f.course) return false;
    if (f.diet && !dietSatisfies(d.diet, f.diet)) return false;
    if (f.max_spice !== undefined && d.spice_level > f.max_spice) return false;
    if (q) {
      const haystack = normalize([d.name, d.local_name ?? "", d.region.name, ...d.ingredients, ...d.tags].join(" "));
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function pickRandom<T>(items: T[], count: number, random = Math.random): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return out;
}
