import { db } from "./db";
import { assignPrizes, computePlacePrizes } from "./payouts";
import { rankEntries } from "./ranking";
import type { DbClient } from "./tx";

export type StandingRow = { rank: number; username: string; wageredSol: number; prizeSol: number };

export function parseSplit(json: string): number[] {
  const value: unknown = JSON.parse(json);
  if (!Array.isArray(value) || !value.every((n) => typeof n === "number")) {
    throw new Error("Stored payout split is not a list of numbers");
  }
  return value;
}

/** Current standings for a period from its wager entries, with exclusions applied. */
export async function computeStandings(
  period: { id: string; prizePoolSol: number; payoutSplit: string },
  client: DbClient = db,
): Promise<StandingRow[]> {
  // Sequential (not Promise.all) so it also works on an interactive transaction client.
  const entries = await client.wagerEntry.findMany({ where: { periodId: period.id }, select: { username: true, wageredSol: true } });
  const excluded = await client.excludedUser.findMany({ select: { username: true } });
  const prizes = computePlacePrizes(period.prizePoolSol, parseSplit(period.payoutSplit));
  return assignPrizes(
    rankEntries(entries, excluded.map((e) => e.username)),
    prizes,
  ).map((r) => ({ rank: r.rank, username: r.username, wageredSol: r.wageredSol, prizeSol: r.prizeSol }));
}
