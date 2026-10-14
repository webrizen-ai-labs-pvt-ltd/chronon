import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };

type Db = ReturnType<typeof drizzle<typeof schema>>;
const globalForDb = globalThis as unknown as { chrononDb?: Db };

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run `pnpm db:local` and copy .env.example to .env.");
  // On Vercel, point DATABASE_URL at a pooled connection (e.g. Neon's -pooler host).
  const client = postgres(url, { max: process.env.VERCEL ? 1 : 10, prepare: false });
  return drizzle(client, { schema });
}

/** Lazily connected so builds and tests don't need a database. */
export function getDb(): Db {
  globalForDb.chrononDb ??= connect();
  return globalForDb.chrononDb;
}
