import { cacheLife, cacheTag } from "next/cache";
import { retainedAffiliateWarning } from "./affiliate-import";
import { db } from "./db";
import type { SourceStatus } from "./freshness";
import { maskUsername } from "./mask";
import { gapsToNextPlace, hallOfFame, type Move, rankMoves } from "./board-stats";
import { approvedNamePreferences } from "./profile";
import { normalizeUsername } from "./ranking";
import { computePlacePrizes, type PlacePrize } from "./payouts";
import { computeStandings, parseSplit, publishedStandings, type StandingRow } from "./standings";

export const LEADERBOARD_TAG = "leaderboard";

export type LeaderboardRow = {
  rank: number;
  name: string;
  wageredSol: number;
  prizeSol: number;
  /** Only set for finalized periods. */
  paid?: boolean;
  /** Live periods: places moved since the previous standings, or "new". */
  move?: Move;
  /** Live periods: SOL needed to pass the next better rank (`gapRank`). */
  gapSol?: number;
  gapRank?: number;
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
  /** Open race totals retained after a required affiliate snapshot was deleted. */
  dataWarning?: string | null;
  masked: boolean;
  /** Health of the automatic data source, for the "may be delayed" notice. */
  source: SourceStatus;
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

async function sourceStatus(): Promise<SourceStatus> {
  // Written by the refresh job (src/lib/refresh.ts).
  const row = await db.setting.findUnique({ where: { key: "providerStatus" } });
  if (!row) return null;
  try {
    const { pull, lastSuccessAt, lastErrorAt } = JSON.parse(row.value) as NonNullable<SourceStatus>;
    return { pull, lastSuccessAt, lastErrorAt };
  } catch {
    return null;
  }
}

async function shouldMask(): Promise<boolean> {
  const setting = await db.setting.findUnique({ where: { key: "maskUsernames" } });
  return setting?.value !== "false";
}

type SnapshotRow = StandingRow;

/** How names are shown publicly right now. */
async function publicNames() {
  const [masked, preferences] = await Promise.all([shouldMask(), approvedNamePreferences()]);
  // A player with an approved profile picks masked or full name for themselves;
  // everyone else follows the site-wide setting.
  const name = (username: string) =>
    (preferences.get(normalizeUsername(username)) ?? masked) ? maskUsername(username) : username;
  return { masked, name };
}

async function buildView(period: PeriodRecord): Promise<LeaderboardView> {
  const [{ masked, name }, source] = await Promise.all([publicNames(), sourceStatus()]);
  const prizes = computePlacePrizes(period.prizePoolSol, parseSplit(period.payoutSplit));

  let ranked: SnapshotRow[];
  let paidBy: Map<string, boolean> | undefined;
  let moves: Map<string, Move> | null = null;
  let gaps: ReturnType<typeof gapsToNextPlace> | undefined;

  if (period.finalizedAt) {
    // Finished periods are shown exactly as they were locked in.
    const [published, payouts] = await Promise.all([
      publishedStandings(period),
      db.payout.findMany({ where: { periodId: period.id } }),
    ]);
    paidBy = new Map(payouts.map((p) => [p.username, p.paid]));
    ranked = published;
  } else {
    ranked = await computeStandings(period);
    const recent = await db.snapshot.findMany({
      where: { periodId: period.id, isFinal: false },
      orderBy: { takenAt: "desc" },
      select: { data: true },
    });
    moves = rankMoves(ranked, recent.map((s) => s.data));
    gaps = gapsToNextPlace(ranked);
  }

  return {
    period: summarize(period),
    rows: ranked.map((r) => ({
      rank: r.rank,
      name: name(r.username),
      wageredSol: r.wageredSol,
      prizeSol: r.prizeSol,
      paid: paidBy && r.prizeSol > 0 ? (paidBy.get(r.username) ?? false) : undefined,
      move: moves?.get(normalizeUsername(r.username)),
      gapSol: gaps?.get(normalizeUsername(r.username))?.sol,
      gapRank: gaps?.get(normalizeUsername(r.username))?.rank,
    })),
    prizes,
    totalWageredSol: ranked.reduce((sum, r) => sum + r.wageredSol, 0),
    playerCount: ranked.length,
    dataUpdatedAt: period.dataUpdatedAt?.toISOString() ?? null,
    dataWarning: period.finalizedAt ? null : await retainedAffiliateWarning(period),
    masked,
    source,
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

export type HallOfFameRow = {
  name: string;
  wins: number;
  podiums: number;
  races: number;
  wonSol: number;
  wageredSol: number;
  bestWeekSol: number;
};

export type HallOfFameView = {
  rows: HallOfFameRow[];
  races: number;
  /** Winners of the most recent finished races, newest first. */
  champions: { periodName: string; startsAt: string; endsAt: string; name: string; prizeSol: number; wageredSol: number }[];
  masked: boolean;
};

/** All-time stats from every finalized race's locked-in results. */
export async function getHallOfFame(): Promise<HallOfFameView> {
  "use cache";
  cacheLife("minutes");
  cacheTag(LEADERBOARD_TAG);

  const [{ masked, name }, periods, excluded] = await Promise.all([
    publicNames(),
    db.period.findMany({
      where: { finalizedAt: { not: null } },
      orderBy: { endsAt: "desc" },
      include: { snapshots: { where: { isFinal: true }, orderBy: { takenAt: "desc" }, take: 1 } },
    }),
    db.excludedUser.findMany({ select: { username: true } }),
  ]);
  const finals = periods
    .filter((p) => p.snapshots.length > 0)
    .map((p) => ({ period: p, rows: JSON.parse(p.snapshots[0].data) as SnapshotRow[] }));
  const excludedKeys = new Set(excluded.map((e) => normalizeUsername(e.username)));

  return {
    rows: hallOfFame(
      finals.map((f) => ({ endsAt: f.period.endsAt, rows: f.rows })),
      excludedKeys,
    ).map(({ username, ...stats }) => ({ name: name(username), ...stats })),
    races: finals.length,
    champions: finals.slice(0, 6).flatMap(({ period, rows }) =>
      rows
        .filter((r) => r.rank === 1 && !excludedKeys.has(normalizeUsername(r.username)))
        .map((r) => ({
          periodName: period.name,
          startsAt: period.startsAt.toISOString(),
          endsAt: period.endsAt.toISOString(),
          name: name(r.username),
          prizeSol: r.prizeSol,
          wageredSol: r.wageredSol,
        })),
    ),
    masked,
  };
}
