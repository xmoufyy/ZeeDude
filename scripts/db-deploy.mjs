// npm run db:deploy
// Brings the database schema up to date for whichever DATABASE_URL is set:
//   Postgres -> `prisma migrate deploy` (applies prisma/postgres/migrations)
//   SQLite   -> `prisma db push`
// Run it before starting a new release (Vercel's build command, Docker's entrypoint).

import { spawnSync } from "node:child_process";
import { isPostgresUrl, resolveDatabaseUrl } from "./prisma-schema.mjs";

const args = isPostgresUrl(resolveDatabaseUrl()) ? ["migrate", "deploy"] : ["db", "push", "--skip-generate"];
const result = spawnSync(process.execPath, ["scripts/prisma.mjs", ...args], { stdio: "inherit" });
process.exit(result.status ?? 1);
