import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  envMode,
  generatedClientProvider,
  isPostgresUrl,
  POSTGRES_SCHEMA,
  resolveDatabaseUrl,
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
    "has a committed migration matching the schema",
    () => {
      const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
      const sql = execFileSync(
        process.execPath,
        [cli, "migrate", "diff", "--from-empty", "--to-schema-datamodel", POSTGRES_SCHEMA, "--script"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      expect(read("prisma/postgres/migrations/0001_init/migration.sql").trim()).toBe(sql.replace(/\r\n/g, "\n").trim());
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

  it("prefers the environment over env files, and returns undefined when nothing sets it", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zd-env-"));
    writeFileSync(path.join(dir, ".env"), "DATABASE_URL=file:./dev.db\n");
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgres://x" }, { cwd: dir })).toBe("postgres://x");
    expect(resolveDatabaseUrl({}, { cwd: path.join(dir, "missing") })).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses env files like dotenv: quotes, inline comments, CRLF", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zd-env-"));
    writeFileSync(path.join(dir, ".env"), 'DATABASE_URL="postgresql://u:p@h/db" # production\r\nX=1\r\n');
    expect(resolveDatabaseUrl({}, { cwd: dir })).toBe("postgresql://u:p@h/db");
    rmSync(dir, { recursive: true, force: true });
  });

  it("uses Next.js env file precedence for the mode", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zd-env-"));
    writeFileSync(path.join(dir, ".env"), "DATABASE_URL=file:./dev.db\n");
    writeFileSync(path.join(dir, ".env.production"), "DATABASE_URL=postgresql://prod/db\n");
    expect(resolveDatabaseUrl({}, { cwd: dir, mode: "production" })).toBe("postgresql://prod/db");
    expect(resolveDatabaseUrl({}, { cwd: dir, mode: "development" })).toBe("file:./dev.db");
    // Next.js order: .env.production.local > .env.local > .env.production > .env
    writeFileSync(path.join(dir, ".env.local"), "DATABASE_URL=postgresql://local/db\n");
    expect(resolveDatabaseUrl({}, { cwd: dir, mode: "production" })).toBe("postgresql://local/db");
    writeFileSync(path.join(dir, ".env.production.local"), "DATABASE_URL=postgresql://prod-local/db\n");
    expect(resolveDatabaseUrl({}, { cwd: dir, mode: "production" })).toBe("postgresql://prod-local/db");
    expect(resolveDatabaseUrl({}, { cwd: dir, mode: "development" })).toBe("postgresql://local/db");
    rmSync(dir, { recursive: true, force: true });
  });

  it("picks production mode from the flag or NODE_ENV", () => {
    expect(envMode(["--env-mode=production"], {})).toBe("production");
    expect(envMode([], { NODE_ENV: "production" })).toBe("production");
    expect(envMode([], {})).toBe("development");
  });

  it("refuses to transform a schema without the expected datasource", () => {
    expect(() => toPostgresSchema('datasource db {\n  provider = "mysql"\n  url = env("DATABASE_URL")\n}')).toThrow();
  });

  it("reads the generated client's provider", () => {
    expect(generatedClientProvider("does-not-exist")).toBeUndefined();
  });
});
