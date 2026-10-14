import { decodeCursor, encodeCursor, filterDishes, getCatalog } from "@/apis/menus/catalog";
import { dishQuerySchema } from "@/apis/menus/schema";
import { parseQuery } from "@/lib/api/query";
import { apiError, apiJson, preflight } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/with-api-key";

/** GET /v1/menus/dishes?region=&country=&course=&diet=&max_spice=&q=&limit=&cursor= */
export const GET = withApiKey((req) => {
  const query = parseQuery(req, dishQuerySchema);
  if (!query.ok) return query.response;
  const { limit, cursor, ...filter } = query.data;

  const offset = decodeCursor(cursor);
  if (offset === null) return apiError(400, "invalid_request", "Invalid `cursor`. Use the `next_cursor` from the previous page.");

  const matches = filterDishes(getCatalog(), filter);
  const data = matches.slice(offset, offset + limit);
  const next = offset + limit < matches.length ? encodeCursor(offset + limit) : null;
  return apiJson({ data, total: matches.length, next_cursor: next });
});

export const OPTIONS = preflight;
