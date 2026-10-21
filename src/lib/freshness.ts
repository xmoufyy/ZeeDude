// Decides whether to warn visitors that the leaderboard may be out of date.

export type SourceStatus = { pull: boolean; lastSuccessAt: string | null; lastErrorAt: string | null } | null;

export type Freshness =
  | { delayed: false }
  | { delayed: true; reason: "database" | "source" | "stale"; since: string | null };

export const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function staleAfterMs(env: Record<string, string | undefined> = process.env): number {
  const minutes = Number(env.DATA_STALE_AFTER_MINUTES);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : DEFAULT_STALE_AFTER_MS;
}

export function assessFreshness(input: {
  now: number;
  /** Served from the last-known-good copy because loading failed. */
  fromFallback: boolean;
  fallbackSavedAt?: string;
  /** Whether the period is still accepting wagers. */
  live: boolean;
  dataUpdatedAt: string | null;
  source: SourceStatus;
  staleAfterMs: number;
}): Freshness {
  if (input.fromFallback) return { delayed: true, reason: "database", since: input.fallbackSavedAt ?? null };

  const { source } = input;
  if (source?.pull && source.lastErrorAt && Date.parse(source.lastErrorAt) > Date.parse(source.lastSuccessAt ?? "0")) {
    return { delayed: true, reason: "source", since: input.dataUpdatedAt };
  }

  if (input.live && input.dataUpdatedAt && input.now - Date.parse(input.dataUpdatedAt) > input.staleAfterMs) {
    return { delayed: true, reason: "stale", since: input.dataUpdatedAt };
  }
  return { delayed: false };
}
