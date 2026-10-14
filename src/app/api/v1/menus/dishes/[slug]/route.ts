import { getCatalog } from "@/apis/menus/catalog";
import { apiError, apiJson, preflight } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/with-api-key";

/** GET /v1/menus/dishes/{slug} */
export const GET = withApiKey<{ slug: string }>(async (_req, ctx) => {
  const { slug } = await ctx.params;
  const dish = getCatalog().dishBySlug.get(slug);
  if (!dish) return apiError(404, "not_found", `No dish called "${slug}". Search at /v1/menus/dishes?q=…`);
  return apiJson({ data: dish });
});

export const OPTIONS = preflight;
