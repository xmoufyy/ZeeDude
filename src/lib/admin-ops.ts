import "server-only";
import { db } from "./db";
import { normalizeUsername } from "./ranking";
import { computeStandings } from "./standings";
import { serializable, type DbClient } from "./tx";

// Database operations behind the admin panel. Callers (Server Actions) are
// responsible for checking the admin session first.
//
// Every operation that checks state and then writes does both inside one
// serializable transaction (see tx.ts), so double-clicks, two open tabs, or
// the cron job running at the same moment can't act on stale state.

export class AdminError extends Error {}

export type PeriodInput = {
  name: string;
  startsAt: Date;
  endsAt: Date;
  prizePoolSol: number;
  payoutSplit: number[];
};

export async function findOverlappingPeriod(startsAt: Date, endsAt: Date, ignoreId?: string, client: DbClient = db) {
  return client.period.findFirst({
    where: {
      id: ignoreId ? { not: ignoreId } : undefined,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
}

/** Throws unless the period exists and hasn't been ended. Pass the transaction client. */
export async function assertEditable(periodId: string, client: DbClient = db) {
  const period = await client.period.findUnique({ where: { id: periodId } });
  if (!period) throw new AdminError("Period not found.");
  if (period.finalizedAt) throw new AdminError("This period has ended. Reopen it to change its data.");
  return period;
}

export async function createPeriod(input: PeriodInput) {
  return serializable(async (tx) => {
    const overlap = await findOverlappingPeriod(input.startsAt, input.endsAt, undefined, tx);
    if (overlap) throw new AdminError(`Those dates overlap "${overlap.name}".`);
    return tx.period.create({ data: { ...input, payoutSplit: JSON.stringify(input.payoutSplit) } });
  });
}

export async function updatePeriod(periodId: string, input: PeriodInput) {
  return serializable(async (tx) => {
    await assertEditable(periodId, tx);
    const overlap = await findOverlappingPeriod(input.startsAt, input.endsAt, periodId, tx);
    if (overlap) throw new AdminError(`Those dates overlap "${overlap.name}".`);
    return tx.period.update({ where: { id: periodId }, data: { ...input, payoutSplit: JSON.stringify(input.payoutSplit) } });
  });
}

/** Saves a point-in-time copy of the standings for an active period. */
export async function snapshotPeriod(periodId: string) {
  const period = await db.period.findUniqueOrThrow({ where: { id: periodId } });
  if (period.finalizedAt) return;
  const data = JSON.stringify(await computeStandings(period));
  // Skip copies identical to the newest one, so the few we keep are distinct
  // standings (the climb arrows compare against the previous ones).
  const newest = await db.snapshot.findFirst({ where: { periodId, isFinal: false }, orderBy: { takenAt: "desc" }, select: { data: true } });
  if (newest?.data === data) return;
  await db.snapshot.create({ data: { periodId, data } });
  // Live snapshots are only a fallback and the climb arrows' history; keep the most recent few per period.
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
  return serializable(async (tx) => {
    const now = new Date();
    const period = await tx.period.findUnique({ where: { id: periodId } });
    if (!period) throw new AdminError("Period not found.");
    if (period.finalizedAt) throw new AdminError("This period is already ended.");
    if (period.startsAt > now) throw new AdminError("This period hasn't started yet. Delete it instead if it's not needed.");

    // Compare-and-set: only one concurrent request can flip finalizedAt, and
    // the loser stops here before touching any payout.
    const claimed = await tx.period.updateMany({
      where: { id: periodId, finalizedAt: null },
      data: { finalizedAt: now, endsAt: period.endsAt > now ? now : period.endsAt },
    });
    if (claimed.count === 0) throw new AdminError("This period is already ended.");

    const standings = await computeStandings(period, tx);
    const winners = standings.filter((s) => s.prizeSol > 0);
    // Reopen refuses while anything is paid, so only unpaid leftovers can exist; never delete a paid row.
    await tx.payout.deleteMany({ where: { periodId, paid: false } });
    await tx.payout.createMany({
      data: winners.map((w) => ({ periodId, rank: w.rank, username: w.username, amountSol: w.prizeSol })),
    });
    await tx.snapshot.create({ data: { periodId, isFinal: true, takenAt: now, data: JSON.stringify(standings) } });
    return { winners: winners.length };
  });
}

/** Undoes finalize so data can be corrected. Refused once any prize is paid. */
export async function reopenPeriod(periodId: string) {
  return serializable(async (tx) => {
    const period = await tx.period.findUnique({ where: { id: periodId } });
    if (!period) throw new AdminError("Period not found.");
    if (!period.finalizedAt) throw new AdminError("This period isn't ended.");
    const paid = await tx.payout.count({ where: { periodId, paid: true } });
    if (paid > 0) throw new AdminError("Can't reopen: some prizes are already marked paid. Unmark them first.");
    await tx.payout.deleteMany({ where: { periodId } });
    await tx.snapshot.deleteMany({ where: { periodId, isFinal: true } });
    await tx.period.update({ where: { id: periodId }, data: { finalizedAt: null } });
  });
}

export async function deletePeriod(periodId: string) {
  return serializable(async (tx) => {
    const paid = await tx.payout.count({ where: { periodId, paid: true } });
    if (paid > 0) throw new AdminError("Can't delete a period with paid prizes. It's part of the payout record.");
    const deleted = await tx.period.deleteMany({ where: { id: periodId } });
    if (deleted.count === 0) throw new AdminError("Period not found.");
  });
}

/** Marks a locked-in prize paid or unpaid. The period must still be ended. */
export async function setPayoutPaid(payoutId: string, paid: boolean, txNote: string | null) {
  return serializable(async (tx) => {
    const payout = await tx.payout.findUnique({ where: { id: payoutId }, include: { period: true } });
    if (!payout) throw new AdminError("This payout no longer exists. The period may have been reopened.");
    if (!payout.period.finalizedAt) throw new AdminError("This period was reopened. End it again before recording payments.");
    return tx.payout.update({
      where: { id: payoutId },
      data: { paid, paidAt: paid ? new Date() : null, txNote },
    });
  });
}

/** Adds a player or replaces their total (matched case-insensitively). */
export async function saveEntry(
  periodId: string,
  data: { username: string; wageredSol: number; wageredUsd?: number },
): Promise<{ updated: string | null }> {
  return serializable(async (tx) => {
    await assertEditable(periodId, tx);
    const entries = await tx.wagerEntry.findMany({ where: { periodId }, select: { id: true, username: true } });
    const match = entries.find((e) => normalizeUsername(e.username) === normalizeUsername(data.username));
    const values = { wageredSol: data.wageredSol, wageredUsd: data.wageredUsd ?? null, source: "manual" };
    if (match) await tx.wagerEntry.update({ where: { id: match.id }, data: values });
    else await tx.wagerEntry.create({ data: { ...values, periodId, username: data.username } });
    await tx.period.update({ where: { id: periodId }, data: { dataUpdatedAt: new Date() } });
    return { updated: match?.username ?? null };
  });
}

export async function deleteEntry(entryId: string): Promise<string> {
  return serializable(async (tx) => {
    const entry = await tx.wagerEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new AdminError("Row not found.");
    await assertEditable(entry.periodId, tx);
    await tx.wagerEntry.delete({ where: { id: entry.id } });
    await tx.period.update({ where: { id: entry.periodId }, data: { dataUpdatedAt: new Date() } });
    return entry.username;
  });
}
