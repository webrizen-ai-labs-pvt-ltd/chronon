import { apiJson, preflight } from "@/lib/api/respond";
import { withApiKey } from "@/lib/api/with-api-key";
import { tiers } from "@/lib/limits";

/** GET /v1/ping: checks that a key works and shows which limits apply to it. */
export const GET = withApiKey((_req, _ctx, auth) =>
  apiJson({
    ok: true,
    key: auth.keyId,
    tier: auth.tier,
    limits: { per_minute: tiers[auth.tier].perMinute, per_month: tiers[auth.tier].perMonth },
    time: new Date().toISOString(),
  }),
);

export const OPTIONS = preflight;
