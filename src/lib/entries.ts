import "server-only";
import { db } from "./db";
import type { ProviderEntry } from "./providers/types";
import { normalizeUsername } from "./ranking";

/**
 * Stores provider data for a period.
 *  - "replace": the entries are the whole leaderboard; anyone missing is removed.
 *  - "merge": only the given players are updated or added.
 * Usernames match existing rows case-insensitively so re-imports update
 * players instead of duplicating them.
 */
export async function saveEntries(
  periodId: string,
  entries: ProviderEntry[],
  mode: "replace" | "merge",
  source: string,
) {
  const existing =
    mode === "merge" ? await db.wagerEntry.findMany({ where: { periodId }, select: { id: true, username: true } }) : [];
  const existingByKey = new Map(existing.map((e) => [normalizeUsername(e.username), e]));

  await db.$transaction([
    ...(mode === "replace" ? [db.wagerEntry.deleteMany({ where: { periodId } })] : []),
    ...entries.map((entry) => {
      const match = existingByKey.get(normalizeUsername(entry.username));
      const data = { wageredSol: entry.wagered, wageredUsd: entry.wageredUsd ?? null, source };
      return match
        ? db.wagerEntry.update({ where: { id: match.id }, data })
        : db.wagerEntry.create({ data: { ...data, periodId, username: entry.username } });
    }),
    db.period.update({ where: { id: periodId }, data: { dataUpdatedAt: new Date() } }),
  ]);
}
