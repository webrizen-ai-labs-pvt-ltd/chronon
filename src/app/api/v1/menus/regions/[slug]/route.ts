import { getCatalog } from "@/apis/menus/catalog";
import { apiError, apiJson, preflight } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/with-api-key";

/** GET /v1/menus/regions/{slug}: the region plus every dish in it. */
export const GET = withApiKey<{ slug: string }>(async (_req, ctx) => {
  const { slug } = await ctx.params;
  const catalog = getCatalog();
  const region = catalog.regionBySlug.get(slug);
  if (!region) return apiError(404, "not_found", `No region called "${slug}". List them at /v1/menus/regions.`);
  const dishes = catalog.dishes.filter((d) => d.region.slug === slug).map(({ region: _r, ...d }) => d);
  return apiJson({ data: { ...region, dishes } });
});

export const OPTIONS = preflight;
