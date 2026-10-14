<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/chronon-mark-paper.svg">
    <img src="public/brand/chronon-mark-night.svg" alt="Chronon" width="96" height="96">
  </picture>
</p>

<h1 align="center">chronon</h1>

<p align="center">
  Free, open-source utility APIs, built and hosted by <strong>Webrizen AI Labs</strong>.<br>
  Sign in with Webrizen, create a key, make your first request in under a minute.
</p>

---

Chronon is a small API platform with no paid plan. Webrizen builds and runs the APIs; anyone can use them.
API keys exist only to keep the service fair: they identify an account so one runaway script can't take the
servers down for everyone else.

| API | Status |
| --- | --- |
| **Regional menus**: 146 dishes from 16 regions, filterable by course, diet and spice | Live |
| Structured data feeds | Planned |
| Automation tools | Planned |

```bash
curl "https://chronon.webrizen.com/v1/menus/dishes?region=kerala&diet=vegan" \
  -H "Authorization: Bearer $CHRONON_KEY"
```

Full documentation ships with the app at [`/docs`](src/app/docs).

## How it works

```
Developer ──► Next.js app on Vercel
                ├─ /             landing page
                ├─ /docs         documentation (MDX)
                ├─ /dashboard    sign in with Webrizen SSO → create / revoke keys, see usage
                └─ /v1/*         the APIs
                      │
                      ▼  withApiKey() on every request
                [1] parse chr_<id>_<secret> from Authorization or X-API-Key
                [2] look up the key (cached 60 s)            ──► Postgres (Neon)
                [3] per-minute window + monthly quota        ──► Upstash Redis
                [4] run the handler, add X-RateLimit-* / X-Quota-* headers
```

- **Keys** are `chr_` + an 8-char public id + a 32-char secret. Only a SHA-256 hash is stored, and the key is shown once.
- **Limits are per account**, not per key: 60 requests/minute and 50,000/month on the Standard tier; 5 active keys.
- **Abuse controls:** lookups of unknown keys are capped per IP, admins can suspend accounts or raise tiers, and
  revocations take effect within a minute.

## Run it locally

Requirements: Node 20+ and pnpm. Docker is not needed.

```bash
pnpm install
cp .env.example .env
pnpm db:local            # embedded Postgres on :54321, leave it running
```

In a second terminal:

```bash
pnpm db:migrate
pnpm dev                 # http://127.0.0.1:3001
pnpm dev:key             # local account + API key, no SSO needed
```

To use the dashboard locally, run Webrizen SSO on `localhost:3000`, register Chronon there
(redirect URI `http://127.0.0.1:3001/api/auth/webrizen/callback`) and fill in the `WEBRIZEN_SSO_*` variables.

| Command | |
| --- | --- |
| `pnpm dev` | Dev server on port 3001 |
| `pnpm check` | Lint, typecheck and tests (run before a PR) |
| `pnpm test` | Vitest |
| `pnpm db:generate` | New migration after editing `src/lib/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm dev:key [email]` | Create a local account and key (local databases only) |

## Project layout

```text
src/
  app/
    api/v1/            route handlers, one folder per endpoint
    dashboard/         key management and admin
    docs/              documentation pages (MDX)
  apis/menus/          regional menus: schema, JSON data per region, query logic
  components/
    base/, application/, foundations/   Untitled UI React components (copied in, MIT)
    landing/           overlay nav, code tabs, live data explorer
    vfx/               WebGL shader canvas and scenes
    lattice.tsx        hairline section layout used across pages
    ambient.tsx        scroll/pointer-driven light effects
  styles/              Untitled UI base theme (re-skinned in app/globals.css)
  lib/
    api/               withApiKey(), error format, query parsing
    db/                Drizzle schema and queries
    keys.ts            key generation and hashing
    ratelimit.ts       sliding window + monthly quota (Redis or memory)
brand/                 brand guide: logo assets, tokens.css, reference sheet
drizzle/               SQL migrations
scripts/               local Postgres and dev-key helpers
tests/                 Vitest suites
```

## Deploy

Vercel (Hobby) + Neon Postgres + Upstash Redis, all on free tiers. Step by step:
[`src/app/docs/deployment/page.mdx`](src/app/docs/deployment/page.mdx).


## Brand & UI

The logo, colours and type come from [`brand/`](brand/README.md). `brand/tokens.css` is imported directly by
the app's stylesheet, so it stays the single source of truth for colours, fonts and radii.

UI components are [Untitled UI React](https://www.untitledui.com/react) (MIT), added with
`npx untitledui@latest add <name>` and committed to `src/components/`. `src/app/globals.css` re-skins them for
Chronon: Tailwind's `neutral` scale runs Paper → Night, the `brand` scale is Photon, and links and focus rings
use Ion. Wrap a section in `.dark-mode` and the components switch to their Night variants.

Page-level styles live in `globals.css`; the scroll and pointer effects are driven by `src/components/ambient.tsx`:

- **Landing VFX:** five hand-written WebGL fragment shaders in `src/components/vfx/scenes.ts`, rendered by
  `ShaderCanvas` (only while on screen, capped pixel ratio, a still frame under reduced motion, CSS gradient
  fallback): light converging into a line (hero; pointer speed adds energy via `u_energy`/`u_flow`), a stippled
  colonnade, a swirling portal, and grainy pastel dunes (footer). Section images live in `src/lib/landing.ts`.
  Page scrolling is smoothed with Lenis (`src/components/smooth-scroll.tsx`). Feature cards use CSS film light leaks (`.leak-card`), and the page
  carries a film grain (`.film-grain`).
- **Lattice (docs, dashboard):** sections sit between hairline rails with "+" registration marks; `.cells` grids
  divide content with the same 1px line.
- **Prism light:** any element with `data-prism` picks up a spectral glow and rim that follow the pointer;
  `.spectrum-rule` hairlines sweep with scroll. All of it is off under `prefers-reduced-motion`.

## Contributing

Fixes to data, docs and code are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Webrizen AI Labs
