import "server-only";
import { assertEditable } from "./admin-ops";
import type { ProviderEntry } from "./providers/types";
import { normalizeUsername } from "./ranking";
import { serializable, type Tx } from "./tx";

/**
 * Stores provider data for a period.
 *  - "replace": the entries are the whole leaderboard; anyone missing is removed.
 *  - "merge": only the given players are updated or added.
 * Usernames match existing rows case-insensitively so re-imports update
 * players instead of duplicating them. The editable check and the writes
 * share one transaction, so data can't land after the period is ended.
 */
export async function saveEntries(
  periodId: string,
  entries: EntryInput[],
  mode: "replace" | "merge",
  source: string,
) {
  // Large imports (up to 10k rows) need more than the default transaction timeout.
  return serializable((tx) => writeEntries(tx, periodId, entries, mode, source), { timeoutMs: 60_000 });
}

type EntryInput = Pick<ProviderEntry, "username" | "wagered" | "wageredUsd">;

/** saveEntries inside a caller's transaction. */
export async function writeEntries(tx: Tx, periodId: string, entries: EntryInput[], mode: "replace" | "merge", source: string) {
  await assertEditable(periodId, tx);
  const existing =
    mode === "merge" ? await tx.wagerEntry.findMany({ where: { periodId }, select: { id: true, username: true } }) : [];
  const existingByKey = new Map(existing.map((e) => [normalizeUsername(e.username), e]));

  if (mode === "replace") await tx.wagerEntry.deleteMany({ where: { periodId } });
  const creates = [];
  for (const entry of entries) {
    const match = existingByKey.get(normalizeUsername(entry.username));
    const data = { wageredSol: entry.wagered, wageredUsd: entry.wageredUsd ?? null, source };
    if (match) await tx.wagerEntry.update({ where: { id: match.id }, data });
    else creates.push({ ...data, periodId, username: entry.username });
  }
  if (creates.length) await tx.wagerEntry.createMany({ data: creates });
  await tx.period.update({ where: { id: periodId }, data: { dataUpdatedAt: new Date() } });
}
