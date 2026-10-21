// Shared helpers for the SQLite/Postgres schema split (see scripts/prisma.mjs).

import { readFileSync } from "node:fs";

export const SQLITE_SCHEMA = "prisma/schema.prisma";
export const POSTGRES_SCHEMA = "prisma/postgres/schema.prisma";

export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//i.test((url ?? "").trim());
}

/**
 * DATABASE_URL from the environment, falling back to the .env file like Prisma does.
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [envFile]
 */
export function resolveDatabaseUrl(env = process.env, envFile = ".env") {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  try {
    const match = /^DATABASE_URL=(.*)$/m.exec(readFileSync(envFile, "utf8"));
    return match ? match[1].trim().replace(/^(["'])(.*)\1$/, "$2") : undefined;
  } catch {
    return undefined;
  }
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
