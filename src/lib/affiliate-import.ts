import "server-only";
import { AdminError } from "./admin-ops";
import {
  type AffiliateRow,
  BOUNDARY_GRACE_MS,
  pickSnapshots,
  type SnapshotRef,
  type WeeklyRow,
  weeklyTotals,
} from "./affiliate";
import { db } from "./db";
import { writeEntries } from "./entries";
import { normalizeUsername } from "./ranking";
import { type DbClient, serializable, type Tx } from "./tx";

/** What a snapshot does to one open period's leaderboard. */
export type PeriodOutcome = {
  periodId: string;
  periodName: string;
  /** null: no earlier copy to compare with yet, so the leaderboard is left alone. */
  baselineAt: Date | null;
  latestAt: Date | null;
  startsAt: Date;
  rows: WeeklyRow[];
  warnings: string[];
};

type Period = { id: string; name: string; startsAt: Date; endsAt: Date };
type PendingSnapshot = { ref: SnapshotRef; rows: AffiliateRow[] };

const NEW_ID = "(this paste)";
const HOUR = 60 * 60 * 1000;
const RETAINED_WARNING = "A snapshot needed to calculate this race is unavailable. Previous totals are retained; waiting for a usable import.";

/**
 * Open periods whose numbers a snapshot taken at `takenAt` can change: any
 * that hadn't ended by then (it can be their latest copy or their starting one).
 */
function affectedPeriods(client: DbClient, takenAt: Date) {
  return client.period.findMany({
    where: { finalizedAt: null, endsAt: { gte: new Date(takenAt.getTime() - BOUNDARY_GRACE_MS) } },
    orderBy: { startsAt: "asc" },
  });
}

async function readings(client: DbClient, snapshotId: string): Promise<AffiliateRow[]> {
  return client.affiliateReading.findMany({ where: { snapshotId }, select: { username: true, lifetimeSol: true } });
}

/** Shared selection for recalculation and for the retained-data warning. */
async function periodSnapshots(client: DbClient, period: Period, pending?: PendingSnapshot) {
  // Every copy from the period's start onward, plus the two newest distinct
  // copy times before it, however old. The newest is the closest "before"
  // candidate; when it's also the latest copy (taken just before the start),
  // the one before it is the baseline.
  const select = { id: true, takenAt: true, createdAt: true } as const;
  const newestBefore = (time: Date) =>
    client.affiliateSnapshot.findFirst({
      where: { takenAt: { lt: time } },
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      select,
    });
  const [inPeriod, before] = await Promise.all([
    client.affiliateSnapshot.findMany({
      where: { takenAt: { gte: period.startsAt, lte: new Date(period.endsAt.getTime() + BOUNDARY_GRACE_MS) } },
      select,
    }),
    newestBefore(period.startsAt),
  ]);
  const beforeThat = before ? await newestBefore(before.takenAt) : null;
  const refs: SnapshotRef[] = [beforeThat, before, ...inPeriod].filter((s) => s !== null);
  if (pending) refs.push(pending.ref);
  return pickSnapshots(refs, period);
}

/** Warn whenever affiliate-derived rows survive without a usable snapshot pair. */
export async function retainedAffiliateWarning(period: Period, client: DbClient = db): Promise<string | null> {
  const entry = await affiliateEntry(client, period.id);
  if (!entry) return null;
  const { latest, baseline } = await periodSnapshots(client, period);
  return latest && baseline ? null : RETAINED_WARNING;
}

function affiliateEntry(client: DbClient, periodId: string) {
  return client.wagerEntry.findFirst({ where: { periodId, source: "affiliate" }, select: { id: true } });
}

/** Works out a period's wagers from the stored snapshots, plus `pending` if it isn't saved yet. */
async function computePeriod(client: DbClient, period: Period, pending?: PendingSnapshot): Promise<PeriodOutcome> {
  const { latest, baseline, baselineOffMs } = await periodSnapshots(client, period, pending);
  const outcome: PeriodOutcome = {
    periodId: period.id,
    periodName: period.name,
    baselineAt: baseline?.takenAt ?? null,
    latestAt: latest?.takenAt ?? null,
    startsAt: period.startsAt,
    rows: [],
    warnings: [],
  };
  if (!latest || !baseline) return outcome;

  const load = (ref: SnapshotRef) => (pending && ref === pending.ref ? pending.rows : readings(client, ref.id));
  const [latestRows, baselineRows] = await Promise.all([load(latest), load(baseline)]);
  const totals = weeklyTotals(latestRows, baselineRows);
  outcome.rows = totals.rows;
  outcome.warnings = totals.warnings;
  if (baselineOffMs !== null && Math.abs(baselineOffMs) > BOUNDARY_GRACE_MS) {
    const hours = Math.round(Math.abs(baselineOffMs) / HOUR);
    outcome.warnings.unshift(
      baselineOffMs > 0
        ? `The starting copy was taken ${hours}h after "${period.name}" began, so wagers before it aren't counted.`
        : `The starting copy was taken ${hours}h before "${period.name}" began, so some earlier wagers are counted too.`,
    );
  }
  return outcome;
}

/** Applies each outcome to its period's leaderboard (replacing it). Outcomes with no baseline are left alone. */
async function apply(tx: Tx, outcomes: PeriodOutcome[]) {
  for (const o of outcomes) {
    if (!o.baselineAt) continue;
    await writeEntries(
      tx,
      o.periodId,
      o.rows.map((r) => ({ username: r.username, wagered: r.wageredSol })),
      "replace",
      "affiliate",
    );
    // Freshness describes the wager reading, not when an old copy was saved
    // or recalculated (including after deleting a newer copy).
    await tx.period.update({ where: { id: o.periodId }, data: { dataUpdatedAt: o.latestAt } });
  }
}

/** Periods worth reporting for a copy: ones with totals, or ones this copy starts (taken around their start). */
function shown(o: PeriodOutcome, takenAt: Date) {
  return o.latestAt !== null || Math.abs(o.startsAt.getTime() - takenAt.getTime()) <= BOUNDARY_GRACE_MS;
}

function checkTakenAt(takenAt: Date, now = new Date()) {
  if (takenAt.getTime() > now.getTime() + 5 * 60_000) throw new AdminError("The copy time can't be in the future.");
}

/** What saving this paste would do, without saving anything. */
export async function previewAffiliateSnapshot(rows: AffiliateRow[], takenAt: Date): Promise<PeriodOutcome[]> {
  checkTakenAt(takenAt);
  const pending = { ref: { id: NEW_ID, takenAt, createdAt: new Date() }, rows };
  const periods = await affectedPeriods(db, takenAt);
  const outcomes = await Promise.all(periods.map((p) => computePeriod(db, p, pending)));
  return outcomes.filter((o) => shown(o, takenAt));
}

/** Stores the paste and recomputes the leaderboard of every open period it touches. */
export async function saveAffiliateSnapshot(rows: AffiliateRow[], takenAt: Date): Promise<PeriodOutcome[]> {
  checkTakenAt(takenAt);
  return serializable(
    async (tx) => {
      const snapshot = await tx.affiliateSnapshot.create({ data: { takenAt } });
      await tx.affiliateReading.createMany({
        data: rows.map((r) => ({ snapshotId: snapshot.id, username: r.username, key: normalizeUsername(r.username), lifetimeSol: r.lifetimeSol })),
      });
      const outcomes = [];
      for (const p of await affectedPeriods(tx, takenAt)) outcomes.push(await computePeriod(tx, p));
      await apply(tx, outcomes);
      return outcomes.filter((o) => shown(o, takenAt));
    },
    { timeoutMs: 60_000 },
  );
}

/**
 * Recomputes an open period from the stored copies, e.g. after its dates were
 * edited, so its totals use the baseline for the new window. Periods whose
 * board doesn't come from affiliate copies are left alone (returns null). With
 * no usable copy for the new dates the totals are kept, and the retained-totals
 * warning explains it, as when a copy is deleted.
 */
export async function recomputeAffiliatePeriod(periodId: string): Promise<PeriodOutcome | null> {
  return serializable(
    async (tx) => {
      const period = await tx.period.findUnique({ where: { id: periodId } });
      if (!period || period.finalizedAt || !(await affiliateEntry(tx, periodId))) return null;
      const outcome = await computePeriod(tx, period);
      await apply(tx, [outcome]);
      return outcome;
    },
    { timeoutMs: 60_000 },
  );
}

/** Deletes a mistaken snapshot and recomputes the open periods it touched. */
export async function deleteAffiliateSnapshot(snapshotId: string): Promise<PeriodOutcome[]> {
  return serializable(
    async (tx) => {
      const snapshot = await tx.affiliateSnapshot.findUnique({ where: { id: snapshotId } });
      if (!snapshot) throw new AdminError("That copy was already deleted.");
      await tx.affiliateSnapshot.delete({ where: { id: snapshotId } });
      const outcomes = [];
      for (const p of await affectedPeriods(tx, snapshot.takenAt)) outcomes.push(await computePeriod(tx, p));
      await apply(tx, outcomes);
      for (const outcome of outcomes) {
        if (outcome.baselineAt) continue;
        if (await affiliateEntry(tx, outcome.periodId)) outcome.warnings.push(RETAINED_WARNING);
      }
      return outcomes.filter((o) => o.latestAt || o.warnings.length);
    },
    { timeoutMs: 60_000 },
  );
}

export async function recentAffiliateSnapshots(limit = 20) {
  const snaps = await db.affiliateSnapshot.findMany({
    orderBy: { takenAt: "desc" },
    take: limit,
    select: { id: true, takenAt: true, _count: { select: { readings: true } } },
  });
  return snaps.map((s) => ({ id: s.id, takenAt: s.takenAt, players: s._count.readings }));
}
