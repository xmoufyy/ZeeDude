// Runs before `npm run dev`: syncs the local SQLite schema and seeds demo data
// the first time, so a fresh clone shows a populated leaderboard immediately.
// Does nothing for Postgres URLs: those are managed with `npm run db:deploy`,
// and seeding would wipe real data.

// Must come first: loads env files like `next dev` before @prisma/client can
// load .env on its own, so the schema push, the seeded-check below, the seed
// run and the app all use one database.
import "../scripts/load-env.mjs";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { isPostgresUrl } from "../scripts/prisma-schema.mjs";

async function main() {
  if (isPostgresUrl(process.env.DATABASE_URL)) {
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
