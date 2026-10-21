// Prisma CLI wrapper: picks the schema that matches DATABASE_URL.
//   postgres:// or postgresql://  -> prisma/postgres/schema.prisma
//   anything else (file:...)      -> prisma/schema.prisma (SQLite)
//
//   node scripts/prisma.mjs generate
//   node scripts/prisma.mjs migrate deploy
//   node scripts/prisma.mjs sync-schema   (regenerate the Postgres schema)
//   node scripts/prisma.mjs which-schema  (print the schema this environment selects)
//
// `generate` is skipped when the client already matches the schema (see clientIsCurrent).

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { clientIsCurrent, isPostgresUrl, POSTGRES_SCHEMA, SQLITE_SCHEMA, toPostgresSchema } from "./prisma-schema.mjs";
import { envMode, loadProjectEnv } from "./project-env.mjs";

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

// Load env files like Next.js does for this mode, so the schema choice and
// Prisma's connection (DATABASE_URL and DIRECT_URL) match what the app sees.
const env = loadProjectEnv(mode);
const schema = isPostgresUrl(env.DATABASE_URL) ? POSTGRES_SCHEMA : SQLITE_SCHEMA;

// Debug/testing aid: print which schema this environment selects.
if (args[0] === "which-schema") {
  console.log(schema);
  process.exit(0);
}

if (args[0] === "generate" && !process.env.PRISMA_FORCE_GENERATE && clientIsCurrent(schema)) {
  console.log(`Prisma client already generated from ${schema}; skipping (set PRISMA_FORCE_GENERATE=1 to force).`);
  process.exit(0);
}
const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [cli, ...args, "--schema", schema], { stdio: "inherit", env });
process.exit(result.status ?? 1);
