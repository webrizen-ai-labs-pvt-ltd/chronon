import { apiError, apiJson, preflight } from "@/lib/api/respond";
import { servedApis } from "@/lib/builder/serve";
import { site } from "@/lib/site";

/** GET /v{n}: the APIs served at this major version. No key needed. */
export async function GET(_req: Request, ctx: { params: Promise<{ version: string }> }) {
  const { version } = await ctx.params;
  const n = /^v([1-9]\d{0,2})$/.exec(version);
  if (!n) return apiError(404, "not_found", "Unknown endpoint. See GET /v1 for the list.");
  const list = await servedApis(Number(n[1]));
  if (!list.length) return apiError(404, "not_found", `Nothing is served at ${version} yet. See GET /v1.`);
  return apiJson({
    name: "Chronon API",
    version,
    docs: `${site.url}/docs`,
    apis: list.map((a) => ({ slug: a.slug, name: a.name, summary: a.summary, status: a.state, base: `${site.url}/${version}/${a.slug}`, docs: `${site.url}/docs/api/${a.slug}` })),
  });
}

export const OPTIONS = preflight;
