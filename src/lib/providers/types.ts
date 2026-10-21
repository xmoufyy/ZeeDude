import { rankEntries } from "../ranking";

/** One player's total for a period, as reported by a data source. */
export type ProviderEntry = {
  username: string;
  /** Total wagered in SOL. */
  wagered: number;
  /** Optional USD value, if the source reports it. */
  wageredUsd?: number;
  /** Rank by wager within this source's data (ties share a rank). Exclusions are applied later. */
  rank: number;
};

export type ProviderPeriod = { id: string; startsAt: Date; endsAt: Date };

export type ProviderKind = "api" | "import" | "manual";

/**
 * A source of wager data. "Pull" providers (the SolPump API) are polled by the
 * cron job; "push" providers (file import, manual entry) only change when an
 * admin supplies data, so the cron job leaves them alone.
 */
export interface LeaderboardProvider {
  readonly kind: ProviderKind;
  readonly pull: boolean;
  fetchEntries(period: ProviderPeriod): Promise<ProviderEntry[]>;
}

/** The provider can't run right now (not configured, bad credentials, outage...). */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function toProviderEntries(rows: { username: string; wageredSol: number; wageredUsd?: number | null }[]): ProviderEntry[] {
  const usdByName = new Map(rows.map((r) => [r.username, r.wageredUsd ?? undefined]));
  // Zero-wager rows are kept (they're real players) but sit unranked at the bottom.
  const zero = rows.filter((r) => r.wageredSol === 0);
  const ranked = rankEntries(rows).map((r) => ({
    username: r.username,
    wagered: r.wageredSol,
    wageredUsd: usdByName.get(r.username),
    rank: r.rank,
  }));
  const lastRank = ranked.length + 1;
  return [...ranked, ...zero.map((r) => ({ username: r.username, wagered: 0, wageredUsd: r.wageredUsd ?? undefined, rank: lastRank }))];
}
