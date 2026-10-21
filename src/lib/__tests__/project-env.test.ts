import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// loadProjectEnv mutates process.env (that's its job), and vitest runs with
// NODE_ENV=test, so each case runs in a clean child process instead.

const ROOT = process.cwd();
const LOADER = path.join(ROOT, "scripts/project-env.mjs").replace(/\\/g, "/");
const WRAPPER = path.join(ROOT, "scripts/prisma.mjs");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "zd-env-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function files(map: Record<string, string>) {
  for (const [name, text] of Object.entries(map)) writeFileSync(path.join(dir, name), text);
}

/** Environment for a child with no inherited DATABASE_URL/DIRECT_URL/NODE_ENV. */
function cleanEnv(extra: Record<string, string> = {}) {
  const env: Record<string, string | undefined> = { ...process.env, ...extra };
  for (const key of ["DATABASE_URL", "DIRECT_URL", "NODE_ENV", "POSTGRES_PRISMA_URL"]) if (!(key in extra)) delete env[key];
  return env as NodeJS.ProcessEnv;
}

function load(mode: "production" | "development", extra: Record<string, string> = {}) {
  const code = `import(${JSON.stringify(`file:///${LOADER}`)}).then((m) => {
    const env = m.loadProjectEnv(${JSON.stringify(mode)}, ${JSON.stringify(dir)});
    console.log(JSON.stringify({ DATABASE_URL: env.DATABASE_URL ?? null, DIRECT_URL: env.DIRECT_URL ?? null }));
  })`;
  const out = execFileSync(process.execPath, ["-e", code], { cwd: dir, env: cleanEnv(extra), encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop()!) as { DATABASE_URL: string | null; DIRECT_URL: string | null };
}

describe("loadProjectEnv (Next.js env file rules)", () => {
  it("uses Next.js precedence for each mode", () => {
    files({
      ".env": "DATABASE_URL=file:./dev.db\n",
      ".env.production": "DATABASE_URL=postgresql://prod/db\n",
    });
    expect(load("production").DATABASE_URL).toBe("postgresql://prod/db");
    expect(load("development").DATABASE_URL).toBe("file:./dev.db");

    files({ ".env.local": "DATABASE_URL=postgresql://local/db\n" });
    expect(load("production").DATABASE_URL).toBe("postgresql://local/db");
    expect(load("development").DATABASE_URL).toBe("postgresql://local/db");

    files({ ".env.production.local": "DATABASE_URL=postgresql://prod-local/db\n" });
    expect(load("production").DATABASE_URL).toBe("postgresql://prod-local/db");
  });

  it("loads DIRECT_URL from the same files as DATABASE_URL", () => {
    files({
      ".env": 'DIRECT_URL="postgresql://wrong/db"\n',
      ".env.production.local": "DATABASE_URL=postgresql://pooled/db\nDIRECT_URL=postgresql://direct/db\n",
    });
    expect(load("production")).toEqual({ DATABASE_URL: "postgresql://pooled/db", DIRECT_URL: "postgresql://direct/db" });
  });

  it("expands ${VAR} references like Next.js", () => {
    files({ ".env": 'POSTGRES_PRISMA_URL=postgresql://vercel/db\nDATABASE_URL="${POSTGRES_PRISMA_URL}"\n' });
    expect(load("production").DATABASE_URL).toBe("postgresql://vercel/db");
  });

  it("handles quotes, inline comments and CRLF", () => {
    files({ ".env": 'DATABASE_URL="postgresql://u:p@h/db" # production\r\nX=1\r\n' });
    expect(load("production").DATABASE_URL).toBe("postgresql://u:p@h/db");
  });

  it("lets the real environment win over files", () => {
    files({ ".env": "DATABASE_URL=file:./dev.db\n" });
    expect(load("production", { DATABASE_URL: "postgresql://real/db" }).DATABASE_URL).toBe("postgresql://real/db");
  });
});

describe("loadProjectEnv under tsx", () => {
  // prisma/ensure-dev-db.ts and prisma/seed.ts run under tsx's CommonJS
  // transform, where interop differs from plain Node (a default import of
  // @next/env came back undefined there).
  it("loads env files when imported from a TypeScript script", () => {
    files({ ".env": "DATABASE_URL=file:./from-tsx.db\n" });
    const script = path.join(dir, "check.ts");
    writeFileSync(
      script,
      `import { loadProjectEnv } from ${JSON.stringify(LOADER)};\nconsole.log(loadProjectEnv("development", ${JSON.stringify(dir)}).DATABASE_URL);\n`,
    );
    const out = execFileSync(process.execPath, ["--import", "tsx", script], { cwd: ROOT, env: cleanEnv(), encoding: "utf8" });
    expect(out.trim().split("\n").pop()).toBe("file:./from-tsx.db");
  });
});

describe("prisma.mjs schema selection", () => {
  const which = (args: string[] = [], extra: Record<string, string> = {}) =>
    execFileSync(process.execPath, [WRAPPER, "which-schema", ...args], { cwd: dir, env: cleanEnv(extra), encoding: "utf8" }).trim();

  it("follows the same env files the app reads", () => {
    files({ ".env": "DATABASE_URL=file:./dev.db\n", ".env.production": 'DATABASE_URL="${PG}" # prod\nPG=postgresql://x/db\n' });
    expect(which()).toBe("prisma/schema.prisma");
    expect(which(["--env-mode=production"])).toBe("prisma/postgres/schema.prisma");
  });
});

describe("envMode", () => {
  it("picks production from the flag or NODE_ENV", async () => {
    const { envMode } = await import("../../../scripts/project-env.mjs");
    expect(envMode(["--env-mode=production"], {})).toBe("production");
    expect(envMode([], { NODE_ENV: "production" })).toBe("production");
    expect(envMode([], {})).toBe("development");
  });
});
