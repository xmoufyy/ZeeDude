// Fills the local database with realistic fake data so the site looks alive
// right away. Safe to re-run: it wipes and recreates everything.
//
//   npm run db:seed

import { PrismaClient } from "@prisma/client";
import { assignPrizes, computePlacePrizes } from "../src/lib/payouts";
import { weeklyWindowOffset } from "../src/lib/period";
import { rankEntries } from "../src/lib/ranking";

const db = new PrismaClient();

// Example prize setup until real numbers are chosen: 10 SOL, top 10 paid,
// top 3 take 72%.
const PRIZE_POOL_SOL = 10;
const PAYOUT_SPLIT = [40, 20, 12, 8, 6, 4, 3, 3, 2, 2];

const PLAYERS = [
  "SolSurfer", "DegenDave", "MoonBagMike", "RugProofRita", "YinYangYeti",
  "CrownChaser", "PumpItPete", "LamportLarry", "DiamondDuke", "GoldGoblin",
  "NeonNinja", "CosmicCarl", "BadBeatBen", "SlotSultan", "DiceDuchess",
  "WhaleWatcher", "PaperHandsPam", "SendItSam", "VaultViper", "LuckyLuna",
  "HodlHarold", "FlipFrenzy", "StackStacy", "TurboTina", "MintMaverick",
  "BlitzBrady", "GrindGina", "ChadCharts",
];

// Staff and a caught alt, to show exclusions working.
const EXCLUDED = [
  { username: "zeedude_staff", reason: "Staff account" },
  { username: "degendave_alt", reason: "Alt of DegenDave" },
];

// Deterministic pseudo-random numbers so every seed looks the same.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function wagersFor(seed: number, players: number, top: number) {
  const rand = rng(seed);
  const shuffled = [...PLAYERS].sort(() => rand() - 0.5).slice(0, players);
  return shuffled.map((username, i) => ({
    username,
    // Roughly exponential falloff from the top player, with some jitter.
    wageredSol: Math.round(top * Math.pow(0.8, i) * (0.85 + rand() * 0.3) * 10_000) / 10_000,
  }));
}

async function main() {
  await db.snapshot.deleteMany();
  await db.payout.deleteMany();
  await db.wagerEntry.deleteMany();
  await db.period.deleteMany();
  await db.excludedUser.deleteMany();
  await db.setting.deleteMany();

  await db.setting.create({ data: { key: "maskUsernames", value: "true" } });
  for (const user of EXCLUDED) {
    await db.excludedUser.create({ data: { username: user.username.toLowerCase(), reason: user.reason } });
  }

  const now = new Date();
  // Three finished weeks plus the live one.
  const weeks = [-3, -2, -1, 0];

  for (const offset of weeks) {
    const { start, end } = weeklyWindowOffset(now, offset);
    const live = offset === 0;
    const entries = wagersFor(1000 + offset, live ? 24 : 20 + offset + 3, 38 + offset * 4);

    if (live) {
      // A tie for 9th/10th to show how ties split a prize, plus the excluded
      // accounts with big wagers that should not appear.
      entries[9].wageredSol = entries[8].wageredSol;
      entries.push({ username: "zeedude_staff", wageredSol: 55.5 });
      entries.push({ username: "DegenDave_ALT", wageredSol: 12.25 });
    }

    const period = await db.period.create({
      data: {
        name: `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`,
        startsAt: start,
        endsAt: end,
        prizePoolSol: PRIZE_POOL_SOL,
        payoutSplit: JSON.stringify(PAYOUT_SPLIT),
        finalizedAt: live ? null : end,
        dataUpdatedAt: live ? new Date(now.getTime() - 23 * 60_000) : end,
        entries: {
          create: entries.map((e) => ({ ...e, source: offset % 2 ? "csv" : "manual" })),
        },
      },
    });

    if (!live) {
      const ranked = assignPrizes(
        rankEntries(entries, EXCLUDED.map((u) => u.username)),
        computePlacePrizes(PRIZE_POOL_SOL, PAYOUT_SPLIT),
      );
      const winners = ranked.filter((r) => r.prizeLamports > 0);
      // Older weeks fully paid; last week only partly paid so the "pending" state shows.
      const paidCount = offset === -1 ? 3 : winners.length;

      await db.payout.createMany({
        data: winners.map((w, i) => ({
          periodId: period.id,
          rank: w.rank,
          username: w.username,
          amountSol: w.prizeSol,
          paid: i < paidCount,
          paidAt: i < paidCount ? new Date(end.getTime() + 6 * 3_600_000) : null,
          txNote: i < paidCount ? "Sent as SolPump tip" : null,
        })),
      });
      await db.snapshot.create({
        data: {
          periodId: period.id,
          takenAt: end,
          isFinal: true,
          data: JSON.stringify(
            ranked.map((r) => ({ rank: r.rank, username: r.username, wageredSol: r.wageredSol, prizeSol: r.prizeSol })),
          ),
        },
      });
    }
    console.log(`Seeded ${period.name}${live ? " (live)" : ""}: ${entries.length} players`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
