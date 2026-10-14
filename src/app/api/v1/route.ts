import { apiJson, preflight } from "@/lib/api/respond";
import { apiBase, site } from "@/lib/site";

/** GET /v1: a public index of the API. No key needed. */
export function GET() {
  return apiJson({
    name: "Chronon API",
    version: "v1",
    docs: `${site.url}/docs`,
    get_a_key: `${site.url}/dashboard`,
    auth: "Authorization: Bearer chr_…",
    endpoints: {
      ping: `${apiBase}/ping`,
      regions: `${apiBase}/menus/regions`,
      region: `${apiBase}/menus/regions/{slug}`,
      dishes: `${apiBase}/menus/dishes`,
      dish: `${apiBase}/menus/dishes/{slug}`,
      random_dish: `${apiBase}/menus/random`,
    },
  });
}

export const OPTIONS = preflight;
