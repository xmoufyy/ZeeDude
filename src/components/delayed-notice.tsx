import type { Freshness } from "@/lib/freshness";
import { formatPeriodDate } from "@/lib/period";
import { Notice } from "./notice";

const MESSAGES = {
  database: "We're having trouble loading the latest leaderboard, so this is the last saved copy",
  source: "We couldn't get new totals from SolPump, so these are the last saved totals",
  stale: "Totals haven't been updated in a while",
};

export function DelayedNotice({ freshness }: { freshness: Freshness }) {
  if (!freshness.delayed) return null;
  return (
    <Notice tone="warning" title="Data may be delayed.">
      {MESSAGES[freshness.reason]}
      {freshness.since && (
        <>
          {" "}
          (as of <time dateTime={freshness.since}>{formatPeriodDate(freshness.since)}</time>)
        </>
      )}
      . Rankings update when fresh data is available.
    </Notice>
  );
}
