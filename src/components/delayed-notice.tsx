import type { Freshness } from "@/lib/freshness";
import { formatPeriodDate } from "@/lib/period";

const MESSAGES = {
  database: "We're having trouble loading the latest leaderboard, so this is the last saved copy",
  source: "We couldn't get new totals from SolPump, so these are the last saved totals",
  stale: "Totals haven't been updated in a while",
};

export function DelayedNotice({ freshness }: { freshness: Freshness }) {
  if (!freshness.delayed) return null;
  return (
    <div role="status" className="flex gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
      <span aria-hidden="true" className="text-gold">⚠</span>
      <p>
        <strong className="text-gold">Data may be delayed.</strong> {MESSAGES[freshness.reason]}
        {freshness.since && (
          <>
            {" "}
            (as of <time dateTime={freshness.since}>{formatPeriodDate(freshness.since)}</time>)
          </>
        )}
        . Rankings update when fresh data is available.
      </p>
    </div>
  );
}
