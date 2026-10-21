// Shared helpers for the SQLite/Postgres schema split (see scripts/prisma.mjs).

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export const SQLITE_SCHEMA = "prisma/schema.prisma";
export const POSTGRES_SCHEMA = "prisma/postgres/schema.prisma";

export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//i.test((url ?? "").trim());
}

// Same env file precedence as Next.js (highest first). The real environment
// always wins over files.
export const ENV_FILES = {
  production: [".env.production.local", ".env.local", ".env.production", ".env"],
  development: [".env.development.local", ".env.local", ".env.development", ".env"],
};

/**
 * "production" when NODE_ENV says so or --env-mode=production was passed.
 * @param {string[]} [args]
 * @param {Record<string, string | undefined>} [env]
 */
export function envMode(args = [], env = process.env) {
  return args.includes("--env-mode=production") || env.NODE_ENV === "production" ? "production" : "development";
}

/**
 * DATABASE_URL as the app will see it: from the environment, else from the
 * first env file that defines it, parsed with Node's dotenv parser (quotes,
 * inline comments, CRLF).
 * @param {Record<string, string | undefined>} [env]
 * @param {{ mode?: "production" | "development", cwd?: string }} [options]
 */
export function resolveDatabaseUrl(env = process.env, { mode = envMode([], env), cwd = "." } = {}) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  for (const file of ENV_FILES[mode]) {
    let text;
    try {
      text = readFileSync(path.join(cwd, file), "utf8");
    } catch {
      continue;
    }
    const value = parseEnv(text).DATABASE_URL;
    if (value) return value;
  }
  return undefined;
}

const SQLITE_DATASOURCE = /datasource db \{\s*provider\s*=\s*"sqlite"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/;

/**
 * Builds the Postgres schema from the SQLite one. Only the datasource block
 * changes; models stay identical so both databases have the same shape.
 */
export function toPostgresSchema(sqliteSchema) {
  if (!SQLITE_DATASOURCE.test(sqliteSchema)) {
    throw new Error(`${SQLITE_SCHEMA}: expected a sqlite datasource block using env("DATABASE_URL")`);
  }
  const body = sqliteSchema.replace(
    SQLITE_DATASOURCE,
    [
      "datasource db {",
      '  provider  = "postgresql"',
      '  url       = env("DATABASE_URL")',
      "  // Non-pooled connection for migrations. Set it equal to DATABASE_URL",
      "  // when your host has no connection pooler.",
      '  directUrl = env("DIRECT_URL")',
      "}",
    ].join("\n"),
  );
  return `// GENERATED from ${SQLITE_SCHEMA} by \`node scripts/prisma.mjs sync-schema\`. Do not edit.\n\n${body}`;
}

/** Provider of the currently generated Prisma client ("sqlite", "postgresql"), if any. */
export function generatedClientProvider(clientDir = "node_modules/.prisma/client") {
  try {
    return /provider\s*=\s*"(\w+)"/.exec(readFileSync(`${clientDir}/schema.prisma`, "utf8").split("datasource")[1] ?? "")?.[1];
  } catch {
    return undefined;
  }
}

/**
 * True when node_modules/.prisma/client was generated from exactly this
 * schema by the installed @prisma/client version, so `generate` can be
 * skipped. Avoids rewriting the engine file while a dev server holds it open
 * (an EPERM error on Windows).
 */
export function clientIsCurrent(schemaFile, clientDir = "node_modules/.prisma/client") {
  try {
    const norm = (s) => s.replace(/\r\n/g, "\n");
    const sameSchema = norm(readFileSync(`${clientDir}/schema.prisma`, "utf8")) === norm(readFileSync(schemaFile, "utf8"));
    const generatedVersion = /"clientVersion":\s*"([^"]+)"/.exec(readFileSync(`${clientDir}/index.js`, "utf8"))?.[1];
    const installedVersion = JSON.parse(readFileSync("node_modules/@prisma/client/package.json", "utf8")).version;
    return sameSchema && generatedVersion === installedVersion;
  } catch {
    return false;
  }
}
