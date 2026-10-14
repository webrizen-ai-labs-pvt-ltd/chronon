import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markPaths } from "@/lib/brand/mark";

describe("Chronon mark", () => {
  it("matches the geometry of the shipped brand SVG", () => {
    const svg = readFileSync(new URL("../brand/assets/chronon-mark-night.svg", import.meta.url), "utf8");
    const shipped = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    expect(shipped).toEqual([...markPaths.goo, ...markPaths.sats, markPaths.core]);
  });
});
