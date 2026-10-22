import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  generatedClientProvider,
  isPostgresUrl,
  POSTGRES_SCHEMA,
  SQLITE_SCHEMA,
  toPostgresSchema,
} from "../../../scripts/prisma-schema.mjs";

// Git may check files out with CRLF on Windows; compare content, not line endings.
const read = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

describe("Postgres schema", () => {
  it("is up to date with prisma/schema.prisma (run `npm run db:sync-schema` if this fails)", () => {
    expect(read(POSTGRES_SCHEMA)).toBe(toPostgresSchema(read(SQLITE_SCHEMA)));
  });

  it("differs from the SQLite schema only in the datasource block", () => {
    const strip = (s: string) =>
      s
        .replace(/^\/\/.*\n/gm, "")
        .replace(/datasource db \{[^}]*\}/, "")
        .trim();
    expect(strip(read(POSTGRES_SCHEMA))).toBe(strip(read(SQLITE_SCHEMA)));
  });

  it(
    "has committed migrations that create everything in the schema",
    () => {
      // Statement-level check without a database: every table and index a
      // from-scratch migration would create appears in some committed migration.
      // verify:postgres runs Prisma's full drift check against a real database.
      const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
      const sql = execFileSync(
        process.execPath,
        [cli, "migrate", "diff", "--from-empty", "--to-schema-datamodel", POSTGRES_SCHEMA, "--script"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const statements = (text: string) =>
        text
          .replace(/\r\n/g, "\n")
          .split(";")
          .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
          .filter((s) => s && !s.startsWith("CREATE SCHEMA"));
      const dir = "prisma/postgres/migrations";
      const committed = new Set(
        readdirSync(dir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .flatMap((d) => statements(read(`${dir}/${d.name}/migration.sql`))),
      );
      const missing = statements(sql).filter((s) => !committed.has(s));
      expect(missing).toEqual([]);
    },
    60_000,
  );
});

describe("schema selection", () => {
  it("recognises Postgres URLs only", () => {
    expect(isPostgresUrl("postgres://u:p@host/db")).toBe(true);
    expect(isPostgresUrl("postgresql://u:p@host/db?sslmode=require")).toBe(true);
    expect(isPostgresUrl("file:./dev.db")).toBe(false);
    expect(isPostgresUrl(undefined)).toBe(false);
  });

  it("refuses to transform a schema without the expected datasource", () => {
    expect(() => toPostgresSchema('datasource db {\n  provider = "mysql"\n  url = env("DATABASE_URL")\n}')).toThrow();
  });

  it("reads the generated client's provider", () => {
    expect(generatedClientProvider("does-not-exist")).toBeUndefined();
  });
});
