import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import { maskUsername } from "./mask";
import { computePlacePrizes, type PlacePrize } from "./payouts";
import { computeStandings, parseSplit, type StandingRow } from "./standings";

export const LEADERBOARD_TAG = "leaderboard";

export type LeaderboardRow = {
  rank: number;
  name: string;
  wageredSol: number;
  prizeSol: number;
  /** Only set for finalized periods. */
  paid?: boolean;
};

export type PeriodSummary = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  prizePoolSol: number;
  finalized: boolean;
};

export type LeaderboardView = {
  period: PeriodSummary;
  rows: LeaderboardRow[];
  prizes: PlacePrize[];
  totalWageredSol: number;
  playerCount: number;
  dataUpdatedAt: string | null;
  masked: boolean;
};

type PeriodRecord = NonNullable<Awaited<ReturnType<typeof db.period.findFirst>>>;

function summarize(period: PeriodRecord): PeriodSummary {
  return {
    id: period.id,
    name: period.name,
    startsAt: period.startsAt.toISOString(),
    endsAt: period.endsAt.toISOString(),
    prizePoolSol: period.prizePoolSol,
    finalized: period.finalizedAt !== null,
  };
}

async function shouldMask(): Promise<boolean> {
  const setting = await db.setting.findUnique({ where: { key: "maskUsernames" } });
  return setting?.value !== "false";
}

type SnapshotRow = StandingRow;

async function buildView(period: PeriodRecord): Promise<LeaderboardView> {
  const masked = await shouldMask();
  const name = (username: string) => (masked ? maskUsername(username) : username);
  const prizes = computePlacePrizes(period.prizePoolSol, parseSplit(period.payoutSplit));

  let ranked: SnapshotRow[];
  let paidBy: Map<string, boolean> | undefined;

  if (period.finalizedAt) {
    // Finished periods are shown exactly as they were locked in.
    const [snapshot, payouts] = await Promise.all([
      db.snapshot.findFirst({
        where: { periodId: period.id, isFinal: true },
        orderBy: { takenAt: "desc" },
      }),
      db.payout.findMany({ where: { periodId: period.id } }),
    ]);
    paidBy = new Map(payouts.map((p) => [p.username, p.paid]));
    ranked = snapshot ? (JSON.parse(snapshot.data) as SnapshotRow[]) : await computeStandings(period);
  } else {
    ranked = await computeStandings(period);
  }

  return {
    period: summarize(period),
    rows: ranked.map((r) => ({
      rank: r.rank,
      name: name(r.username),
      wageredSol: r.wageredSol,
      prizeSol: r.prizeSol,
      paid: paidBy && r.prizeSol > 0 ? (paidBy.get(r.username) ?? false) : undefined,
    })),
    prizes,
    totalWageredSol: ranked.reduce((sum, r) => sum + r.wageredSol, 0),
    playerCount: ranked.length,
    dataUpdatedAt: period.dataUpdatedAt?.toISOString() ?? null,
    masked,
  };
}

/**
 * The period running right now, or if there's a gap between periods, the
 * next one to start, falling back to the most recent one.
 */
export async function getCurrentLeaderboard(): Promise<LeaderboardView | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LEADERBOARD_TAG);

  const now = new Date();
  const period =
    (await db.period.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now }, finalizedAt: null },
      orderBy: { startsAt: "desc" },
    })) ??
    (await db.period.findFirst({ where: { startsAt: { gt: now } }, orderBy: { startsAt: "asc" } })) ??
    (await db.period.findFirst({ orderBy: { endsAt: "desc" } }));

  return period ? buildView(period) : null;
}

/** Finished periods, newest first. */
export async function getPastPeriods(): Promise<PeriodSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LEADERBOARD_TAG);

  const periods = await db.period.findMany({
    where: { OR: [{ finalizedAt: { not: null } }, { endsAt: { lte: new Date() } }] },
    orderBy: { endsAt: "desc" },
  });
  return periods.map(summarize);
}

export async function getLeaderboardForPeriod(id: string): Promise<LeaderboardView | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LEADERBOARD_TAG);

  const period = await db.period.findUnique({ where: { id } });
  return period ? buildView(period) : null;
}
