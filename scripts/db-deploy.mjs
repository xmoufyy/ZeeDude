// npm run db:deploy
// Brings the database schema up to date for whichever DATABASE_URL is set:
//   Postgres -> `prisma migrate deploy` (applies prisma/postgres/migrations)
//   SQLite   -> `prisma db push`
// Run it before starting a new release (Vercel's build command, Docker's entrypoint).

import { spawnSync } from "node:child_process";
import { isPostgresUrl } from "./prisma-schema.mjs";
import { envMode, loadProjectEnv } from "./project-env.mjs";

const flags = process.argv.slice(2).filter((a) => a.startsWith("--env-mode="));
const env = loadProjectEnv(envMode(flags));
// On Vercel the filesystem is read-only and wiped between requests, so a
// SQLite database can't work: fail the build instead of deploying a broken site.
if (process.env.VERCEL && !isPostgresUrl(env.DATABASE_URL)) {
  console.error(
    "DATABASE_URL must be a postgres:// or postgresql:// connection string on Vercel " +
      `(it starts with "${String(env.DATABASE_URL ?? "").split(":")[0] || "nothing"}"). ` +
      "Set it in Project Settings -> Environment Variables, along with DIRECT_URL, then redeploy.",
  );
  process.exit(1);
}
const args = isPostgresUrl(env.DATABASE_URL) ? ["migrate", "deploy"] : ["db", "push", "--skip-generate"];
const result = spawnSync(process.execPath, ["scripts/prisma.mjs", ...args, ...flags], { stdio: "inherit" });
process.exit(result.status ?? 1);
