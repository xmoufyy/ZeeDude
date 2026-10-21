// Runs before `npm run dev`: syncs the local SQLite schema and seeds demo data
// the first time, so a fresh clone shows a populated leaderboard immediately.
// Does nothing for Postgres URLs: those are managed with `npm run db:deploy`,
// and seeding would wipe real data.

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { isPostgresUrl, resolveDatabaseUrl } from "../scripts/prisma-schema.mjs";

async function main() {
  if (isPostgresUrl(resolveDatabaseUrl())) {
    console.log("DATABASE_URL is Postgres: skipping automatic schema push and demo seed. Use `npm run db:deploy`.");
    return;
  }

  execSync("node scripts/prisma.mjs db push --skip-generate", { stdio: "inherit" });

  const db = new PrismaClient();
  const periods = await db.period.count();
  await db.$disconnect();

  if (periods === 0) {
    console.log("Empty database, seeding demo data...");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  }
}

main();
