// Local PostgreSQL without Docker: `pnpm db:local` (keep it running while you develop).
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dataDir = fileURLToPath(new URL("../.data/postgres", import.meta.url));
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "chronon",
  password: "chronon",
  port: 54321,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const fresh = !existsSync(dataDir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("chronon");
console.log("PostgreSQL ready at postgres://chronon:chronon@localhost:54321/chronon");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
