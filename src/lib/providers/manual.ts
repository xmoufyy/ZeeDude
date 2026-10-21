import { db } from "../db";
import { toProviderEntries, type LeaderboardProvider, type ProviderEntry, type ProviderPeriod } from "./types";

/**
 * Wager data maintained by hand in the admin panel. The database is the
 * source of truth, so this just reads back what's stored for the period.
 */
export class ManualProvider implements LeaderboardProvider {
  readonly kind = "manual" as const;
  readonly pull = false;

  async fetchEntries(period: ProviderPeriod): Promise<ProviderEntry[]> {
    const rows = await db.wagerEntry.findMany({
      where: { periodId: period.id },
      select: { username: true, wageredSol: true, wageredUsd: true },
    });
    return toProviderEntries(rows);
  }
}
