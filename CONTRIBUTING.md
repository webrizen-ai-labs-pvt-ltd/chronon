# Contributing to Chronon

Thanks for helping. The full guide lives in the docs at
[`/docs/contributing`](src/app/docs/contributing/page.mdx); this is the short version.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:local        # keep running
pnpm db:migrate
pnpm dev             # http://127.0.0.1:3001
pnpm dev:key         # local API key, no SSO needed
```

## Before you open a pull request

```bash
pnpm check           # lint + typecheck + tests
```

- Keep changes focused: one fix or feature per PR.
- Match the surrounding code style: 2 spaces, double quotes, semicolons. `pnpm lint` catches most of it.
- Add or update tests in `tests/` when you change behaviour.
- If you change the database schema, run `pnpm db:generate` and commit the migration.

## Menu data

Each region is one JSON file in `src/apis/menus/data/`. `pnpm test` validates every file and checks that slugs are
unique. Accuracy matters more than volume: when unsure about a diet label, choose the stricter one; leave
`local_name` as `null` unless you're confident of the spelling.

## New APIs

Open an issue first describing the endpoints and data source, so we can agree on the shape before you build it.
Every handler goes through `withApiKey()` so authentication and limits stay consistent.

## Security

Please don't open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).
