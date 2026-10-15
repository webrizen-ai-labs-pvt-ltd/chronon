import { apiJson, preflight } from "@/lib/api/respond";
import { servedApis } from "@/lib/builder/serve";
import { apiBase, site } from "@/lib/site";

/** GET /v1: a public index of the API. No key needed. */
export async function GET() {
  const list = await servedApis(1);
  return apiJson({
    name: "Chronon API",
    version: "v1",
    docs: `${site.url}/docs`,
    get_a_key: `${site.url}/dashboard`,
    auth: "Authorization: Bearer chr_…",
    ping: `${apiBase}/ping`,
    apis: list.map((a) => ({
      slug: a.slug,
      name: a.name,
      summary: a.summary,
      status: a.state,
      base: `${apiBase}/${a.slug}`,
      docs: `${site.url}/docs/api/${a.slug}`,
    })),
  });
}

export const OPTIONS = preflight;
