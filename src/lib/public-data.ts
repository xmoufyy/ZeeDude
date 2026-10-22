import "server-only";
import { tmpdir } from "node:os";
import path from "node:path";
import { unstable_rethrow } from "next/navigation";
import { createFallbackStore } from "./fallback";
import { maskBoardForFallback } from "./fallback-sanitize";
import { getCurrentLeaderboard, getLeaderboardForPeriod, getPastPeriods } from "./leaderboard";

// Public pages load data through these wrappers: if the database (or the
// cache behind it) fails, they serve the last good copy instead of an error
// page, and the page shows a "data may be delayed" notice. Saved copies have
// every name masked (fail closed), so an outage can't undo a privacy choice.

const fallbackStore = createFallbackStore(
  process.env.FALLBACK_CACHE_DIR?.trim() || path.join(tmpdir(), "zeedude-leaderboard"),
  { rethrow: unstable_rethrow },
);

export function loadCurrentLeaderboard() {
  return fallbackStore.withFallback("current-leaderboard", getCurrentLeaderboard, maskBoardForFallback);
}

export function loadPastPeriods() {
  return fallbackStore.withFallback("past-periods", getPastPeriods);
}

export function loadLeaderboardForPeriod(id: string) {
  return fallbackStore.withFallback(`period-${id}`, () => getLeaderboardForPeriod(id), maskBoardForFallback);
}
