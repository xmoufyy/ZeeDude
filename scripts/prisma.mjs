// Prisma CLI wrapper: picks the schema that matches DATABASE_URL.
//   postgres:// or postgresql://  -> prisma/postgres/schema.prisma
//   anything else (file:...)      -> prisma/schema.prisma (SQLite)
//
//   node scripts/prisma.mjs generate
//   node scripts/prisma.mjs migrate deploy
//   node scripts/prisma.mjs sync-schema   (regenerate the Postgres schema)

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { isPostgresUrl, POSTGRES_SCHEMA, resolveDatabaseUrl, SQLITE_SCHEMA, toPostgresSchema } from "./prisma-schema.mjs";

const args = process.argv.slice(2);

if (args[0] === "sync-schema") {
  mkdirSync(path.dirname(POSTGRES_SCHEMA), { recursive: true });
  writeFileSync(POSTGRES_SCHEMA, toPostgresSchema(readFileSync(SQLITE_SCHEMA, "utf8")));
  console.log(`Wrote ${POSTGRES_SCHEMA}`);
  process.exit(0);
}

const schema = isPostgresUrl(resolveDatabaseUrl()) ? POSTGRES_SCHEMA : SQLITE_SCHEMA;
const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [cli, ...args, "--schema", schema], { stdio: "inherit" });
process.exit(result.status ?? 1);
