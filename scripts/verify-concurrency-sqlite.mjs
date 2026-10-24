// npm run verify:concurrency
// Runs scripts/verify-concurrency.ts against a throwaway SQLite file, so the
// real dev database is never touched.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generatedClientProvider } from "./prisma-schema.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "zd-verify-sqlite-"));
const databaseFile = path.join(dir, "verify.db");
// Some Windows schema-engine builds fail to create a missing SQLite file.
// An empty file is a valid starting point for db push in this disposable DB.
writeFileSync(databaseFile, "");
const url = `file:${databaseFile.replace(/\\/g, "/")}`;
const env = { ...process.env, DATABASE_URL: url, VERIFY_CONCURRENCY_THROWAWAY: "1" };

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env, timeout: 20 * 60_000, killSignal: "SIGKILL" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }
}

try {
  // Skip regenerating when the client is already SQLite: on Windows a running
  // dev server locks the engine file and generate would fail.
  if (generatedClientProvider() !== "sqlite") run(process.execPath, ["scripts/prisma.mjs", "generate"]);
  run(process.execPath, ["scripts/prisma.mjs", "db", "push", "--skip-generate"]);
  run(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/verify-concurrency.ts"]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
