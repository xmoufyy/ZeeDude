// Race-condition checks for the admin write paths and the login limiter
// (PLAN.md criterion 17). Runs the real operations in parallel against the
// database in DATABASE_URL, which must be a THROWAWAY database: every table
// is wiped between scenarios.
//
// Don't run this directly; use `npm run verify:concurrency` (temp SQLite) or
// `npm run verify:postgres` (temp Postgres). Needs the react-server import
// condition so `server-only` modules load:
//   node --conditions=react-server --import tsx scripts/verify-concurrency.ts

import { finalizePeriod, reopenPeriod, setPayoutPaid } from "../src/lib/admin-ops";
import { db } from "../src/lib/db";
import { MAX_FAILURES_PER_IP, reserveLoginAttempt } from "../src/lib/login-limiter";
import { weeklyWindow } from "../src/lib/period";
import { reviewClaim, saveProfile } from "../src/lib/profile";
import { ensureCurrentPeriod } from "../src/lib/refresh";
import { createWalletChallenge, MAX_OPEN_NONCES } from "../src/lib/wallet-challenge";

if (process.env.VERIFY_CONCURRENCY_THROWAWAY !== "1") {
  console.error("Refusing to run: this wipes the database. Use npm run verify:concurrency or verify:postgres.");
  process.exit(2);
}

const REPEATS = 5;
const RUN_TIMEOUT_MS = 60_000;
const SPLIT = JSON.stringify([40, 20, 12, 8, 6, 4, 3, 3, 2, 2]);
const DAY = 24 * 60 * 60 * 1000;

async function wipe() {
  await db.snapshot.deleteMany();
  await db.payout.deleteMany();
  await db.wagerEntry.deleteMany();
  await db.period.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.excludedUser.deleteMany();
  await db.walletNonce.deleteMany();
  await db.player.deleteMany();
}

async function livePeriodWithPlayers(players = 15) {
  const now = Date.now();
  return db.period.create({
    data: {
      name: "Race test",
      startsAt: new Date(now - DAY),
      endsAt: new Date(now + DAY),
      prizePoolSol: 10,
      payoutSplit: SPLIT,
      entries: {
        create: Array.from({ length: players }, (_, i) => ({ username: `player${i}`, wageredSol: 100 - i * 3 })),
      },
    },
  });
}

function settle<T>(tasks: (() => Promise<T>)[]) {
  return Promise.allSettled(tasks.map((t) => t()));
}

type Check = { name: string; run: () => Promise<string | null> };

const checks: Check[] = [
  {
    name: "10 parallel ensureCurrentPeriod -> exactly 1 period for the week",
    async run() {
      await wipe();
      const { start, end } = weeklyWindow(new Date());
      // A finished earlier period to copy the prize setup from.
      await db.period.create({
        data: { name: "Template", startsAt: new Date(start.getTime() - 7 * DAY), endsAt: start, prizePoolSol: 5, payoutSplit: SPLIT },
      });
      const results = await settle(Array.from({ length: 10 }, () => () => ensureCurrentPeriod()));
      const failed = results.filter((r) => r.status === "rejected");
      const count = await db.period.count({ where: { startsAt: { lt: end }, endsAt: { gt: start } } });
      if (count !== 1) return `expected 1 period this week, found ${count}`;
      if (failed.length) return `unexpected errors: ${failed.map((f) => String((f as PromiseRejectedResult).reason)).join("; ")}`;
      return null;
    },
  },
  {
    name: "10 parallel finalizations -> exactly 1 succeeds, payouts = winners, 1 final snapshot",
    async run() {
      await wipe();
      const period = await livePeriodWithPlayers(15);
      const results = await settle(Array.from({ length: 10 }, () => () => finalizePeriod(period.id)));
      const ok = results.filter((r) => r.status === "fulfilled");
      const unexpected = results.filter(
        (r) => r.status === "rejected" && !/already ended|busy/i.test(String((r as PromiseRejectedResult).reason)),
      );
      const payouts = await db.payout.count({ where: { periodId: period.id } });
      const finals = await db.snapshot.count({ where: { periodId: period.id, isFinal: true } });
      if (ok.length !== 1) return `expected 1 successful finalize, got ${ok.length}`;
      if (unexpected.length) return `unexpected errors: ${unexpected.map((u) => String((u as PromiseRejectedResult).reason)).join("; ")}`;
      if (payouts !== 10) return `expected 10 payouts (10 paid places), found ${payouts}`;
      if (finals !== 1) return `expected 1 final snapshot, found ${finals}`;
      return null;
    },
  },
  {
    name: "mark-paid racing reopen -> a paid payout is never deleted",
    async run() {
      await wipe();
      const period = await livePeriodWithPlayers(15);
      await finalizePeriod(period.id);
      const first = await db.payout.findFirstOrThrow({ where: { periodId: period.id }, orderBy: { rank: "asc" } });
      // Alternate which call starts first between repeats.
      const tasks = [() => setPayoutPaid(first.id, true, "race"), () => reopenPeriod(period.id)];
      if (Math.random() < 0.5) tasks.reverse();
      await settle<unknown>(tasks);

      const after = await db.period.findUniqueOrThrow({ where: { id: period.id } });
      const paidRows = await db.payout.count({ where: { periodId: period.id, paid: true } });
      const payoutExists = await db.payout.count({ where: { id: first.id } });
      if (after.finalizedAt === null) {
        // Reopen won: the payment must never have committed.
        if (paidRows !== 0 || payoutExists !== 0) return "period reopened but payout rows survived";
      } else {
        // Payment won: the payout must still be there, marked paid.
        if (paidRows !== 1 || payoutExists !== 1) return `period still ended but paid rows = ${paidRows}`;
      }
      return null;
    },
  },
  {
    name: `40 parallel login reservations from one IP -> at most ${MAX_FAILURES_PER_IP} allowed, no rows written once locked`,
    async run() {
      await wipe();
      const results = await Promise.all(Array.from({ length: 40 }, () => reserveLoginAttempt(db, "203.0.113.7")));
      const allowed = results.filter((r) => r.allowed).length;
      if (allowed > MAX_FAILURES_PER_IP) return `${allowed} reservations allowed`;
      // Once locked, further attempts are rejected without writing rows (bounded growth).
      const rowsLocked = await db.loginAttempt.count();
      for (let i = 0; i < 20; i++) {
        if ((await reserveLoginAttempt(db, "203.0.113.7")).allowed) return "an attempt was allowed while locked out";
      }
      const rowsAfter = await db.loginAttempt.count();
      if (rowsAfter !== rowsLocked) return `locked-out attempts still wrote rows (${rowsLocked} -> ${rowsAfter})`;
      return null;
    },
  },
  {
    name: "admin approval is bound to the reviewed name (stale or repeated decisions refused)",
    async run() {
      await wipe();
      const wallet = "WalletForClaimTest11111111111111";
      await db.player.create({ data: { wallet } });
      const base = { hideName: true };
      await saveProfile(wallet, { ...base, solpumpUsername: "Alice" });
      const player = await db.player.findUniqueOrThrow({ where: { wallet } });
      // The player switches to another name after the admin loaded "alice".
      await saveProfile(wallet, { ...base, solpumpUsername: "Bob" });
      const stale = await reviewClaim(player.id, "approve", "alice").then(() => "approved", (e) => String(e.message));
      const afterStale = await db.player.findUniqueOrThrow({ where: { wallet } });
      if (stale === "approved" || afterStale.solpumpStatus !== "pending" || afterStale.solpumpKey !== "bob") {
        return `stale approval was applied (${stale}; status ${afterStale.solpumpStatus}, key ${afterStale.solpumpKey})`;
      }
      await reviewClaim(player.id, "approve", "bob");
      const again = await reviewClaim(player.id, "reject", "bob").then(() => "rejected", () => "refused");
      const final = await db.player.findUniqueOrThrow({ where: { wallet } });
      if (again !== "refused" || final.solpumpStatus !== "approved") return `reject after approve was applied (${final.solpumpStatus})`;
      return null;
    },
  },
  {
    name: "10 parallel sign-in starts for one wallet -> exactly 1 open challenge",
    async run() {
      await wipe();
      const wallet = "SameWallet1111111111111111111111";
      const results = await settle(Array.from({ length: 10 }, () => () => createWalletChallenge(wallet, "verify.test")));
      const rows = await db.walletNonce.count({ where: { wallet } });
      const unexpected = results.filter(
        (r) => r.status === "rejected" && !/in progress|try again/i.test(String((r as PromiseRejectedResult).reason)),
      );
      if (rows !== 1) return `expected 1 challenge for the wallet, found ${rows}`;
      if (unexpected.length) return `unexpected errors: ${unexpected.map((u) => String((u as PromiseRejectedResult).reason)).join("; ")}`;
      return null;
    },
  },
  {
    name: `parallel sign-in starts near the cap -> never more than ${MAX_OPEN_NONCES} open challenges`,
    async run() {
      await wipe();
      const future = new Date(Date.now() + 60_000);
      await db.walletNonce.createMany({
        data: Array.from({ length: MAX_OPEN_NONCES - 5 }, (_, i) => ({ nonce: `fill${i}`, wallet: `FillWallet${i}`, message: "x", expiresAt: future })),
      });
      await settle(Array.from({ length: 20 }, (_, i) => () => createWalletChallenge(`CapWallet${i}`, "verify.test")));
      const total = await db.walletNonce.count();
      if (total > MAX_OPEN_NONCES) return `${total} open challenges (cap ${MAX_OPEN_NONCES})`;
      return null;
    },
  },
];
async function main() {
  const target = (process.env.DATABASE_URL ?? "").split(":")[0];
  console.log(`Concurrency checks against ${target} (each repeated ${REPEATS}x)`);
  let failures = 0;
  for (const check of checks) {
    const problems: string[] = [];
    for (let i = 1; i <= REPEATS; i++) {
      try {
        // A run that never settles (e.g. a stalled database connection) fails
        // the check instead of hanging the verifier forever.
        const problem = await Promise.race([
          check.run(),
          new Promise<string>((resolve) => setTimeout(() => resolve(`timed out after ${RUN_TIMEOUT_MS / 1000}s`), RUN_TIMEOUT_MS).unref()),
        ]);
        if (problem) problems.push(`run ${i}: ${problem}`);
        if (problem?.startsWith("timed out")) break; // later runs would hit the same stall
      } catch (error) {
        problems.push(`run ${i}: threw ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (problems.length) {
      failures++;
      console.log(`FAIL  ${check.name}\n      ${problems.join("\n      ")}`);
    } else {
      console.log(`PASS  ${check.name}`);
    }
  }
  await wipe();
  await db.$disconnect();
  if (failures) {
    console.error(`${failures} concurrency check(s) failed`);
    process.exit(1);
  }
  console.log("All concurrency checks passed");
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
