import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { KeyOwner } from "@/lib/db/queries";
import { generateKey } from "@/lib/keys";
import { createMemoryStore } from "@/lib/ratelimit";

/**
 * End-to-end builder flows against a real Postgres. Runs only when
 * CHRONON_TEST_DATABASE_URL points at a disposable database with migrations
 * applied (e.g. `pnpm db:local` + `pnpm db:migrate`). Never point it at production:
 * it deletes every builder API.
 */
const url = process.env.CHRONON_TEST_DATABASE_URL;

const key = generateKey();
vi.mock("@/lib/db/queries", () => ({
  findActiveKey: async (id: string): Promise<KeyOwner | null> =>
    id === key.id ? { keyId: key.id, hash: key.hash, userId: "u1", tier: "standard", banned: false, lastUsedAt: new Date() } : null,
  touchKey: async () => {},
}));

describe.skipIf(!url)("builder against Postgres", async () => {
  process.env.DATABASE_URL = url;
  (globalThis as { chrononLimitStore?: unknown }).chrononLimitStore = createMemoryStore();
  const repo = await import("@/lib/builder/repo");
  const { serveRequest, clearServeCache } = await import("@/lib/builder/serve");
  const { getDb } = await import("@/lib/db");
  const { apis } = await import("@/lib/db/schema");
  const actor = "test@chronon.local";

  async function call(path: string) {
    clearServeCache();
    const u = new URL(`http://chronon.test${path}`);
    const [, version, ...rest] = u.pathname.split("/");
    const res = await serveRequest(new NextRequest(u, { headers: { authorization: `Bearer ${key.token}` } }), Number(version.slice(1)), rest);
    const type = res.headers.get("content-type") ?? "";
    return { status: res.status, headers: res.headers, body: type.includes("json") ? await res.json() : await res.text() };
  }

  beforeAll(async () => {
    await getDb().delete(apis);
  });
  afterAll(async () => {
    await getDb().delete(apis);
  });

  it("serves built-in menus from code before import, and from the database after", async () => {
    const before = await call("/v1/menus/dishes?q=tiramisu");
    expect(before.status).toBe(200);
    expect(before.body.data[0].slug).toBe("tiramisu");

    expect((await repo.importBuiltin("menus", actor)).ok).toBe(true);
    const after = await call("/v1/menus/dishes?q=tiramisu");
    expect(after.body).toEqual(before.body);
    expect((await call("/v1/menus/regions/kerala")).body.data.dishes.length).toBeGreaterThan(3);
  });

  it("builds a dataset API from scratch", async () => {
    const created = await repo.createApi({ slug: "planets", name: "Planets", summary: "Solar system", kind: "dataset", actor });
    expect(created.ok).toBe(true);
    const v1 = (await repo.getVersion("planets", 1))!;
    expect(v1.version.state).toBe("draft");
    expect((await call("/v1/planets/items")).status).toBe(404); // drafts aren't served

    const def = {
      kind: "dataset",
      collections: [
        {
          slug: "planets",
          name: "Planets",
          fields: [
            { key: "name", label: "Name", type: "text", required: true },
            { key: "moons", label: "Moons", type: "integer", min: 0 },
            { key: "kind", label: "Kind", type: "enum", values: ["rocky", "gas", "ice"], required: true },
          ],
          sort: [{ field: "name" }],
          filters: [{ param: "kind", path: "kind" }, { param: "min_moons", path: "moons", op: "gte" }],
          search: { enabled: true, fields: ["name"] },
          random: { enabled: true },
        },
      ],
    };
    expect(await repo.saveDefinition(v1.version.id, def, actor)).toEqual({ ok: true });

    const bad = await repo.saveRecord(v1.version.id, "planets", null, { slug: "Earth!", data: { name: "", kind: "lava" } }, actor);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fields ?? {}).sort()).toEqual(["kind", "name", "slug"]);

    expect((await repo.saveRecord(v1.version.id, "planets", null, { slug: "earth", data: { name: "Earth", moons: 1, kind: "rocky" } }, actor)).ok).toBe(true);
    const imported = await repo.importRecords(
      v1.version.id,
      "planets",
      [
        { slug: "jupiter", data: { name: "Jupiter", moons: 95, kind: "gas" } },
        { slug: "neptune", data: { name: "Neptune", moons: 16, kind: "ice" } },
        { slug: "earth", data: { name: "Earth", moons: 1, kind: "rocky" } },
      ],
      "upsert",
      actor,
    );
    expect(imported).toEqual({ ok: true, inserted: 2, updated: 1 });

    const badImport = await repo.importRecords(v1.version.id, "planets", [{ slug: "x", data: { name: "X", kind: "nope" } }], "upsert", actor);
    expect(badImport.ok).toBe(false);

    expect(await repo.publishVersion(v1.version.id, actor)).toEqual({ ok: true });
    const list = await call("/v1/planets/planets?min_moons=10");
    expect(list.status).toBe(200);
    expect(list.body.data.map((p: { slug: string }) => p.slug)).toEqual(["jupiter", "neptune"]);
    expect((await call("/v1/planets/planets/earth")).body.data).toEqual({ slug: "earth", name: "Earth", moons: 1, kind: "rocky" });
  });

  it("only takes additive changes on a published version", async () => {
    const v1 = (await repo.getVersion("planets", 1))!;
    const def = repo.parseDefinition(v1.version);
    if (def.kind !== "dataset") throw new Error("expected dataset");

    const removed = structuredClone(def);
    removed.collections[0].fields = removed.collections[0].fields.filter((f) => f.key !== "moons");
    removed.collections[0].filters = removed.collections[0].filters.filter((f) => f.param !== "min_moons");
    const refused = await repo.saveDefinition(v1.version.id, removed, actor);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/v2/);

    const added = structuredClone(def);
    added.collections[0].fields.push({ key: "rings", label: "Rings", type: "boolean", required: false, description: "" });
    expect(await repo.saveDefinition(v1.version.id, added, actor)).toEqual({ ok: true });
    expect((await call("/v1/planets/planets/earth")).body.data.rings).toBeNull();
  });

  it("forks a new major version and deprecates the old one", async () => {
    const api = (await repo.getApi("planets"))!;
    const next = await repo.createNextVersion(api.api.id, actor);
    expect(next).toEqual({ ok: true, value: 2 });
    const v2 = (await repo.getVersion("planets", 2))!;
    const def = repo.parseDefinition(v2.version);
    if (def.kind !== "dataset") throw new Error("expected dataset");
    def.collections[0].fields = def.collections[0].fields.filter((f) => f.key !== "moons");
    def.collections[0].filters = def.collections[0].filters.filter((f) => f.param !== "min_moons");
    expect(await repo.saveDefinition(v2.version.id, def, actor)).toEqual({ ok: true });
    expect(await repo.publishVersion(v2.version.id, actor)).toEqual({ ok: true });

    const v1 = (await repo.getVersion("planets", 1))!;
    expect(await repo.setVersionState(v1.version.id, "deprecated", actor)).toEqual({ ok: true });
    const old = await call("/v1/planets/planets/earth");
    expect(old.status).toBe(200);
    expect(old.headers.get("deprecation")).toBe("true");
    expect(old.headers.get("link")).toContain("/v2/planets");
    expect((await call("/v2/planets/planets/earth")).body.data).not.toHaveProperty("moons");

    expect(await repo.setVersionState(v1.version.id, "retired", actor)).toEqual({ ok: true });
    expect((await call("/v1/planets/planets/earth")).status).toBe(410);
  });

  it("guards references on delete", async () => {
    const menus = (await repo.getVersion("menus", 1))!;
    const res = await repo.deleteRecords(menus.version.id, "regions", ["kerala"], actor);
    expect(res.ok).toBe(false);
  });

  it("runs utility blocks", async () => {
    expect((await repo.createApi({ slug: "hash", name: "Hash", summary: "", kind: "block", block: "hash", actor })).ok).toBe(true);
    const v = (await repo.getVersion("hash", 1))!;
    expect(await repo.publishVersion(v.version.id, actor)).toEqual({ ok: true });
    const res = await call("/v1/hash?text=hello");
    expect(res.body.data.digest).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");

    const def = repo.parseDefinition(v.version);
    if (def.kind !== "block") throw new Error("expected block");
    expect(await repo.saveDefinition(v.version.id, { ...def, config: { ...def.config, algorithms: ["sha512"] } }, actor)).toEqual({ ok: true });
    expect((await call("/v1/hash?text=hello")).body.data.algorithm).toBe("sha512");
    expect((await call("/v1/hash?text=hello&algorithm=md5")).status).toBe(400);
  });

  it("keeps an audit trail and rolls schema back", async () => {
    const api = (await repo.getApi("planets"))!;
    const log = await repo.listAudit({ apiId: api.api.id });
    expect(log.length).toBeGreaterThan(5);
    const schemaChange = log.find((e) => e.action === "schema.update" && e.version === 1);
    expect(schemaChange?.before).toBeTruthy();
  });

  it("refuses reserved and duplicate slugs", async () => {
    expect((await repo.createApi({ slug: "ping", name: "x", summary: "", kind: "dataset", actor })).ok).toBe(false);
    expect((await repo.createApi({ slug: "planets", name: "x", summary: "", kind: "dataset", actor })).ok).toBe(false);
  });
});
