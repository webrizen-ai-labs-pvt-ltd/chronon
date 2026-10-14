import { z } from "zod";
import { filterDishes, getCatalog, pickRandom } from "@/apis/menus/catalog";
import { dishQuerySchema } from "@/apis/menus/schema";
import { parseQuery } from "@/lib/api/query";
import { apiError, apiJson, preflight } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/with-api-key";

const randomQuerySchema = dishQuerySchema.omit({ limit: true, cursor: true }).extend({
  count: z.coerce.number().int().min(1).max(10).default(1),
});

/** GET /v1/menus/random?count=3&diet=vegan… : random dishes matching the same filters as /dishes. */
export const GET = withApiKey((req) => {
  const query = parseQuery(req, randomQuerySchema);
  if (!query.ok) return query.response;
  const { count, ...filter } = query.data;
  const matches = filterDishes(getCatalog(), filter);
  if (matches.length === 0) return apiError(404, "not_found", "No dishes match those filters.");
  return apiJson({ data: pickRandom(matches, count) });
});

export const OPTIONS = preflight;
