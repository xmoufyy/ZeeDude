// Runs before `npm run dev`: syncs the local SQLite schema and seeds demo data
// the first time, so a fresh clone shows a populated leaderboard immediately.

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

async function main() {
  const db = new PrismaClient();
  const periods = await db.period.count();
  await db.$disconnect();

  if (periods === 0) {
    console.log("Empty database, seeding demo data...");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  }
}

main();
