/**
 * Creates a local developer account and an API key without going through SSO.
 *   pnpm dev:key                 → dev@localhost
 *   pnpm dev:key you@example.com
 * Refuses to run against a non-local database.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { apiKeys, users } from "../src/lib/db/schema";
import { generateKey } from "../src/lib/keys";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (copy .env.example to .env).");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error(`dev:key only runs against a local database, not ${host}.`);
}

const email = process.argv[2] ?? "dev@localhost";
const client = postgres(url, { max: 1 });
const db = drizzle(client);

const [user] = await db
  .insert(users)
  .values({ ssoSub: `dev:${email}`, email, name: "Local developer" })
  .onConflictDoUpdate({ target: users.ssoSub, set: { lastSeenAt: new Date() } })
  .returning();

const key = generateKey();
await db.insert(apiKeys).values({ id: key.id, userId: user.id, name: "Local dev key", hash: key.hash });
await client.end();

console.log(`\nKey for ${email} (shown once):\n\n  ${key.token}\n`);
console.log(`Try it:\n  curl -H "Authorization: Bearer ${key.token}" http://127.0.0.1:3001/v1/ping\n`);
