import { z } from "zod";
import { getCatalog } from "@/apis/menus/catalog";
import { parseQuery } from "@/lib/api/query";
import { apiJson, preflight } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/with-api-key";

const querySchema = z.object({
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/, "use a 2-letter country code")
    .transform((s) => s.toUpperCase())
    .optional(),
});

/** GET /v1/menus/regions?country=IN */
export const GET = withApiKey((req) => {
  const query = parseQuery(req, querySchema);
  if (!query.ok) return query.response;
  const { country } = query.data;
  const data = getCatalog().regions.filter((r) => !country || r.country_code === country);
  return apiJson({ data, total: data.length });
});

export const OPTIONS = preflight;
