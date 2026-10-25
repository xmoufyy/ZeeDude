// Pure leaderboard extras: climb arrows, gap to the next place, and the
// all-time Hall of Fame. No database access; callers pass standings in.

import { normalizeUsername } from "./ranking";
import { lamportsToSol, solToLamports } from "./sol";
import type { StandingRow } from "./standings";

/** Places moved since the previous standings (positive = climbed), or "new". */
export type Move = number | "new";

// What counts as a change in standings. Prizes are left out: editing the pool
// or the split re-prices places without anyone moving.
const standingsKey = (rows: StandingRow[]) => JSON.stringify(rows.map((r) => [r.rank, r.username, r.wageredSol]));

/**
 * Each player's movement against the newest earlier snapshot that differs from
 * the current standings. `snapshots` are stored snapshot JSON, newest first.
 * Returns null when there's nothing earlier to compare with.
 */
export function rankMoves(current: StandingRow[], snapshots: string[]): Map<string, Move> | null {
  const now = standingsKey(current);
  let before: StandingRow[] | undefined;
  for (const snapshot of snapshots) {
    let rows: StandingRow[];
    try {
      rows = JSON.parse(snapshot) as StandingRow[];
    } catch {
      return null;
    }
    if (standingsKey(rows) !== now) {
      before = rows;
      break;
    }
  }
  if (!before) return null;
  const oldRank = new Map(before.map((r) => [normalizeUsername(r.username), r.rank]));
  return new Map(
    current.map((r) => {
      const was = oldRank.get(normalizeUsername(r.username));
      return [normalizeUsername(r.username), was === undefined ? "new" : was - r.rank];
    }),
  );
}

/**
 * SOL each player needs to pass the next better rank (players tied with them
 * don't count). Leaders, and players tied for first, have no gap.
 */
export function gapsToNextPlace(ranked: StandingRow[]): Map<string, { sol: number; rank: number }> {
  const gaps = new Map<string, { sol: number; rank: number }>();
  // Rows are sorted best first, so the nearest better rank is the last row of
  // the previous rank group. One pass: boards can hold thousands of rows.
  let ahead: StandingRow | undefined;
  let previous: StandingRow | undefined;
  for (const row of ranked) {
    if (previous && previous.rank < row.rank) ahead = previous;
    previous = row;
    if (!ahead) continue;
    gaps.set(normalizeUsername(row.username), {
      sol: lamportsToSol(solToLamports(ahead.wageredSol) - solToLamports(row.wageredSol)),
      rank: ahead.rank,
    });
  }
  return gaps;
}

export type FinalResult = { endsAt: Date; rows: StandingRow[] };

export type HallOfFameEntry = {
  username: string;
  wins: number;
  podiums: number;
  races: number;
  wonSol: number;
  wageredSol: number;
  bestWeekSol: number;
};

/**
 * All-time totals across finished races. Players are matched case-insensitively
 * and shown under the name from their most recent race. Excluded players are
 * left out entirely. Sorted by SOL won, then wins, then total wagered.
 */
export function hallOfFame(finals: FinalResult[], excludedUsernames: Iterable<string> = []): HallOfFameEntry[] {
  const excluded = new Set(Array.from(excludedUsernames, normalizeUsername));
  const byKey = new Map<string, HallOfFameEntry & { won: number; wagered: number; lastSeen: number }>();
  for (const race of finals) {
    for (const row of race.rows) {
      const key = normalizeUsername(row.username);
      if (excluded.has(key)) continue;
      const entry = byKey.get(key) ?? {
        username: row.username,
        wins: 0,
        podiums: 0,
        races: 0,
        wonSol: 0,
        wageredSol: 0,
        bestWeekSol: 0,
        won: 0,
        wagered: 0,
        lastSeen: -Infinity,
      };
      if (race.endsAt.getTime() > entry.lastSeen) {
        entry.username = row.username;
        entry.lastSeen = race.endsAt.getTime();
      }
      entry.races += 1;
      if (row.rank === 1) entry.wins += 1;
      if (row.rank <= 3) entry.podiums += 1;
      entry.won += solToLamports(row.prizeSol);
      entry.wagered += solToLamports(row.wageredSol);
      entry.bestWeekSol = Math.max(entry.bestWeekSol, row.wageredSol);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .map(({ won, wagered, lastSeen: _lastSeen, ...e }) => ({ ...e, wonSol: lamportsToSol(won), wageredSol: lamportsToSol(wagered) }))
    .sort((a, b) => b.wonSol - a.wonSol || b.wins - a.wins || b.wageredSol - a.wageredSol || a.username.localeCompare(b.username));
}
