import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Podium } from "@/components/podium";
import { DelayedNotice } from "@/components/delayed-notice";
import { loadLeaderboardForPeriod, loadPastPeriods } from "@/lib/public-data";
import { formatPeriodDate, formatPeriodRange } from "@/lib/period";
import { formatSol } from "@/lib/sol";

export const metadata: Metadata = {
  title: "Past Winners",
  description: "Final results and winners from previous ZeeDude SolPump wager races.",
};

export default function HistoryPage({ searchParams }: PageProps<"/history">) {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pt-8 sm:pt-12">
      <header className="space-y-2">
        <h1 className="font-display text-3xl sm:text-5xl">
          Past <span className="text-gold-gradient">Winners</span>
        </h1>
        <p className="max-w-2xl text-muted">Final standings from every finished race, and whether each prize has been sent.</p>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" />}>
        <PastBoard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PastBoard({ searchParams }: Pick<PageProps<"/history">, "searchParams">) {
  // Read the query first so the database is only hit at request time, never during the build.
  const { period: requested } = await searchParams;
  const pastLoad = await loadPastPeriods();
  const periods = pastLoad.value;

  if (periods.length === 0) {
    return <p className="panel px-5 py-10 text-center text-muted">No races have finished yet. The first winners will show up here.</p>;
  }

  const selectedId = periods.some((p) => p.id === requested) ? (requested as string) : periods[0].id;
  const boardLoad = await loadLeaderboardForPeriod(selectedId);
  const board = boardLoad.value;
  if (!board) return null;
  const fallback = pastLoad.fromFallback ? pastLoad : boardLoad.fromFallback ? boardLoad : null;
  const { period, rows } = board;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Choose a past race" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <h2 className="mb-3 text-xs font-semibold tracking-[0.2em] text-muted uppercase">Races</h2>
        {/* Horizontal scroller on mobile, vertical list on desktop. */}
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {periods.map((p) => {
            const active = p.id === selectedId;
            return (
              <li key={p.id} className="shrink-0">
                <Link
                  href={`/history?period=${p.id}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-xl border px-4 py-2.5 transition ${
                    active ? "border-gold/50 bg-gold/10 text-gold" : "border-line text-muted hover:border-white/20 hover:text-text"
                  }`}
                >
                  <span className="block font-semibold whitespace-nowrap">{formatPeriodRange(p.startsAt, p.endsAt)}</span>
                  <span className="text-xs opacity-80">{formatSol(p.prizePoolSol)} SOL pool</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="past-heading" className="min-w-0 space-y-8">
        {fallback && <DelayedNotice freshness={{ delayed: true, reason: "database", since: fallback.savedAt }} />}
        {board.dataWarning && <p role="status" className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">{board.dataWarning}</p>}
        <div>
          <h2 id="past-heading" className="font-display text-2xl">
            {period.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {formatPeriodDate(period.startsAt)} → {formatPeriodDate(period.endsAt)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {board.playerCount} {board.playerCount === 1 ? "player" : "players"} ·{" "}
            {formatSol(board.totalWageredSol, { max: 2 })} SOL wagered · {formatSol(period.prizePoolSol)} SOL prize pool
          </p>
        </div>
        {!period.finalized && (
          <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            Unofficial results: this race has ended but hasn&apos;t been confirmed yet, so standings and prizes may still change.
          </p>
        )}
        <div className="pt-6">
          <Podium rows={rows} />
        </div>
        <LeaderboardTable rows={rows.slice(3)} caption={`${period.name} ${period.finalized ? "final" : "unofficial"} standings, 4th place and below`} />
      </section>
    </div>
  );
}
