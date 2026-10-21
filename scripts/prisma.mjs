// Prisma CLI wrapper: picks the schema that matches DATABASE_URL.
//   postgres:// or postgresql://  -> prisma/postgres/schema.prisma
//   anything else (file:...)      -> prisma/schema.prisma (SQLite)
//
//   node scripts/prisma.mjs generate
//   node scripts/prisma.mjs migrate deploy
//   node scripts/prisma.mjs sync-schema   (regenerate the Postgres schema)
//
// `generate` is skipped when the client already matches the schema (see clientIsCurrent).

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  clientIsCurrent,
  envMode,
  isPostgresUrl,
  POSTGRES_SCHEMA,
  resolveDatabaseUrl,
  SQLITE_SCHEMA,
  toPostgresSchema,
} from "./prisma-schema.mjs";

const rawArgs = process.argv.slice(2);
// --env-mode=production makes env-file lookup match `next build`/`next start`.
const mode = envMode(rawArgs);
const args = rawArgs.filter((a) => !a.startsWith("--env-mode="));

if (args[0] === "sync-schema") {
  mkdirSync(path.dirname(POSTGRES_SCHEMA), { recursive: true });
  writeFileSync(POSTGRES_SCHEMA, toPostgresSchema(readFileSync(SQLITE_SCHEMA, "utf8")));
  console.log(`Wrote ${POSTGRES_SCHEMA}`);
  process.exit(0);
}

const databaseUrl = resolveDatabaseUrl(process.env, { mode });
const schema = isPostgresUrl(databaseUrl) ? POSTGRES_SCHEMA : SQLITE_SCHEMA;

if (args[0] === "generate" && !process.env.PRISMA_FORCE_GENERATE && clientIsCurrent(schema)) {
  console.log(`Prisma client already generated from ${schema}; skipping (set PRISMA_FORCE_GENERATE=1 to force).`);
  process.exit(0);
}
const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
// Hand Prisma the same URL we chose the schema from (it only reads .env itself).
const env = databaseUrl ? { ...process.env, DATABASE_URL: databaseUrl } : process.env;
const result = spawnSync(process.execPath, [cli, ...args, "--schema", schema], { stdio: "inherit", env });
process.exit(result.status ?? 1);
