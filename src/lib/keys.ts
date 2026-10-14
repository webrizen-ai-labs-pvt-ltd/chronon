import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * API key format: chr_<id>_<secret>
 *   id     8 chars [a-z0-9]   public, stored in plain text, shown in the dashboard
 *   secret 32 chars base62    ~190 bits of entropy, never stored
 * The database keeps sha256(full key) only.
 */
export const KEY_PATTERN = /^chr_([a-z0-9]{8})_([A-Za-z0-9]{32})$/;

const LOWER = "abcdefghijklmnopqrstuvwxyz0123456789";
const BASE62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Unbiased random string from `alphabet` (rejection sampling). */
function randomString(length: number, alphabet: string) {
  const max = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < max) out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export function hashKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateKey() {
  const id = randomString(8, LOWER);
  const token = `chr_${id}_${randomString(32, BASE62)}`;
  return { id, token, hash: hashKey(token) };
}

/** Returns the public id if `token` is shaped like a Chronon key. */
export function parseKey(token: string | null | undefined): { id: string; token: string } | null {
  const match = token?.trim().match(KEY_PATTERN);
  return match ? { id: match[1], token: match[0] } : null;
}

/** Constant-time comparison of a presented key against a stored hash. */
export function verifyKey(token: string, storedHash: string) {
  const a = Buffer.from(hashKey(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** How a key is displayed after creation: chr_ab12cd34_•••• */
export function maskKey(id: string) {
  return `chr_${id}_••••••••`;
}
