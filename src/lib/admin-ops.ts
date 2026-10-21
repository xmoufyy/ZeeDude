import "server-only";
import { db } from "./db";
import { computeStandings } from "./standings";

// Database operations behind the admin panel. Callers (Server Actions) are
// responsible for checking the admin session first.

export class AdminError extends Error {}

export async function findOverlappingPeriod(startsAt: Date, endsAt: Date, ignoreId?: string) {
  return db.period.findFirst({
    where: {
      id: ignoreId ? { not: ignoreId } : undefined,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
}

/** Saves a point-in-time copy of the standings for an active period. */
export async function snapshotPeriod(periodId: string) {
  const period = await db.period.findUniqueOrThrow({ where: { id: periodId } });
  if (period.finalizedAt) return;
  const standings = await computeStandings(period);
  await db.snapshot.create({ data: { periodId, data: JSON.stringify(standings) } });
  // Live snapshots are only a fallback; keep the most recent few per period.
  const stale = await db.snapshot.findMany({
    where: { periodId, isFinal: false },
    orderBy: { takenAt: "desc" },
    skip: 5,
    select: { id: true },
  });
  if (stale.length) await db.snapshot.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
}

/**
 * Locks in results: computes final standings, records a payout for every
 * winner, and stores a final snapshot so later edits or bans don't change
 * history. Ending early moves the end time to now.
 */
export async function finalizePeriod(periodId: string) {
  const period = await db.period.findUniqueOrThrow({ where: { id: periodId } });
  if (period.finalizedAt) throw new AdminError("This period is already ended.");
  const now = new Date();
  if (period.startsAt > now) throw new AdminError("This period hasn't started yet. Delete it instead if it's not needed.");

  const standings = await computeStandings(period);
  const winners = standings.filter((s) => s.prizeSol > 0);

  await db.$transaction([
    db.payout.deleteMany({ where: { periodId } }),
    db.payout.createMany({
      data: winners.map((w) => ({ periodId, rank: w.rank, username: w.username, amountSol: w.prizeSol })),
    }),
    db.snapshot.create({ data: { periodId, isFinal: true, takenAt: now, data: JSON.stringify(standings) } }),
    db.period.update({
      where: { id: periodId },
      data: { finalizedAt: now, endsAt: period.endsAt > now ? now : period.endsAt },
    }),
  ]);
  return { winners: winners.length };
}

/** Undoes finalize so data can be corrected. Refused once any prize is paid. */
export async function reopenPeriod(periodId: string) {
  const paid = await db.payout.count({ where: { periodId, paid: true } });
  if (paid > 0) throw new AdminError("Can't reopen: some prizes are already marked paid. Unmark them first.");
  await db.$transaction([
    db.payout.deleteMany({ where: { periodId } }),
    db.snapshot.deleteMany({ where: { periodId, isFinal: true } }),
    db.period.update({ where: { id: periodId }, data: { finalizedAt: null } }),
  ]);
}

export async function assertEditable(periodId: string) {
  const period = await db.period.findUnique({ where: { id: periodId } });
  if (!period) throw new AdminError("Period not found.");
  if (period.finalizedAt) throw new AdminError("This period has ended. Reopen it to change its data.");
  return period;
}
