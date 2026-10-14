import { describe, expect, it } from "vitest";
import { generateKey, hashKey, KEY_PATTERN, maskKey, parseKey, verifyKey } from "@/lib/keys";

describe("API keys", () => {
  it("generates well-formed, unique keys", () => {
    const keys = Array.from({ length: 200 }, generateKey);
    for (const k of keys) {
      expect(k.token).toMatch(KEY_PATTERN);
      expect(k.token.startsWith(`chr_${k.id}_`)).toBe(true);
      expect(k.hash).toBe(hashKey(k.token));
    }
    expect(new Set(keys.map((k) => k.token)).size).toBe(keys.length);
  });

  it("parses keys and rejects anything else", () => {
    const { id, token } = generateKey();
    expect(parseKey(token)).toEqual({ id, token });
    expect(parseKey(`  ${token}  `)).toEqual({ id, token });
    for (const bad of [null, undefined, "", "chr_", `${token}x`, token.replace("chr_", "sk_"), "chr_ABCDEFGH_" + "a".repeat(32)]) {
      expect(parseKey(bad)).toBeNull();
    }
  });

  it("verifies against the stored hash only", () => {
    const a = generateKey();
    const b = generateKey();
    expect(verifyKey(a.token, a.hash)).toBe(true);
    expect(verifyKey(b.token, a.hash)).toBe(false);
    expect(verifyKey(a.token, "not-hex")).toBe(false);
  });

  it("never stores or shows the secret", () => {
    const k = generateKey();
    const secret = k.token.split("_")[2];
    expect(k.hash).not.toContain(secret);
    expect(maskKey(k.id)).not.toContain(secret);
    expect(maskKey(k.id).startsWith(`chr_${k.id}_`)).toBe(true);
  });
});
