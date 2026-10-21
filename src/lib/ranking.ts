export type WagerInput = {
  username: string;
  wageredSol: number;
};

export type RankedEntry = WagerInput & {
  /** Competition ranking: equal wagers share a rank (1, 2, 2, 4). */
  rank: number;
  /** 0-based position in the sorted list; tied players occupy consecutive positions. */
  position: number;
};

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Sorts players by wager (highest first) and assigns ranks.
 * Excluded users and zero/negative/invalid wagers are dropped before ranking,
 * so they never take a prize slot. If the same username appears more than once
 * (case-insensitive), their wagers are merged.
 */
export function rankEntries(
  entries: readonly WagerInput[],
  excludedUsernames: Iterable<string> = [],
): RankedEntry[] {
  const excluded = new Set(Array.from(excludedUsernames, normalizeUsername));
  const merged = new Map<string, WagerInput>();

  for (const entry of entries) {
    const key = normalizeUsername(entry.username);
    if (!key || excluded.has(key)) continue;
    if (!Number.isFinite(entry.wageredSol) || entry.wageredSol <= 0) continue;
    const existing = merged.get(key);
    merged.set(key, {
      username: existing?.username ?? entry.username.trim(),
      wageredSol: (existing?.wageredSol ?? 0) + entry.wageredSol,
    });
  }

  const sorted = [...merged.values()].sort(
    (a, b) =>
      b.wageredSol - a.wageredSol ||
      a.username.localeCompare(b.username, "en", { sensitivity: "base" }),
  );

  let rank = 0;
  return sorted.map((entry, position) => {
    if (position === 0 || !sameWager(entry.wageredSol, sorted[position - 1].wageredSol)) {
      rank = position + 1;
    }
    return { ...entry, rank, position };
  });
}

// Wagers are compared at lamport precision so 1.1 + 2.2 vs 3.3 style float
// noise doesn't split a genuine tie.
function sameWager(a: number, b: number): boolean {
  return Math.round(a * 1e9) === Math.round(b * 1e9);
}
