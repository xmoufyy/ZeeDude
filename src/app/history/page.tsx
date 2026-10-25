import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Podium } from "@/components/podium";
import { DelayedNotice } from "@/components/delayed-notice";
import { Notice } from "@/components/notice";
import { RaceList } from "@/components/race-list";
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

  const selectedIndex = Math.max(0, periods.findIndex((p) => p.id === requested));
  const selectedId = periods[selectedIndex].id;
  const boardLoad = await loadLeaderboardForPeriod(selectedId);
  const board = boardLoad.value;
  if (!board) return null;
  const fallback = pastLoad.fromFallback ? pastLoad : boardLoad.fromFallback ? boardLoad : null;
  const { period, rows } = board;
  // Periods are newest first.
  const newer = periods[selectedIndex - 1];
  const older = periods[selectedIndex + 1];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Choose a past race" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <h2 className="label-caps mb-3 tracking-[0.2em]">Races</h2>
        {/* Horizontal scroller on mobile, vertical list on desktop. */}
        <RaceList selectedId={selectedId}>
          {periods.map((p) => {
            const active = p.id === selectedId;
            return (
              <li key={p.id} className="shrink-0 snap-start">
                <Link
                  href={`/history?period=${p.id}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-xl border px-4 py-2.5 transition ${
                    active
                      ? "border-gold/50 bg-gold/10 text-gold shadow-[0_0_24px_-12px] shadow-gold"
                      : "border-line bg-panel/60 text-muted hover:border-white/20 hover:text-text"
                  }`}
                >
                  <span className="block font-semibold whitespace-nowrap">{formatPeriodRange(p.startsAt, p.endsAt)}</span>
                  <span className="text-xs opacity-80">{formatSol(p.prizePoolSol)} SOL pool</span>
                </Link>
              </li>
            );
          })}
        </RaceList>
      </nav>

      <section aria-labelledby="past-heading" className="min-w-0 space-y-8">
        {fallback && <DelayedNotice freshness={{ delayed: true, reason: "database", since: fallback.savedAt }} />}
        {board.dataWarning && <Notice tone="warning">{board.dataWarning}</Notice>}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="past-heading" className="section-title">
                {period.name}
              </h2>
              {period.finalized ? (
                <span className="badge badge-success">
                  <span aria-hidden="true">✓</span> Final
                </span>
              ) : (
                <span className="badge badge-warning">
                  <span aria-hidden="true">⚠</span> Unofficial
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatPeriodDate(period.startsAt)} → {formatPeriodDate(period.endsAt)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {board.playerCount} {board.playerCount === 1 ? "player" : "players"} ·{" "}
              {formatSol(board.totalWageredSol, { max: 2 })} SOL wagered · {formatSol(period.prizePoolSol)} SOL prize pool
            </p>
          </div>
          {(older || newer) && (
            <div className="flex gap-2">
              {older ? (
                <Link href={`/history?period=${older.id}`} scroll={false} className="btn">
                  <span aria-hidden="true">←</span> Older race
                </Link>
              ) : (
                <span className="btn opacity-40" aria-hidden="true">
                  <span aria-hidden="true">←</span> Older race
                </span>
              )}
              {newer ? (
                <Link href={`/history?period=${newer.id}`} scroll={false} className="btn">
                  Newer race <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span className="btn opacity-40" aria-hidden="true">
                  Newer race <span aria-hidden="true">→</span>
                </span>
              )}
            </div>
          )}
        </div>
        {!period.finalized && (
          <Notice tone="warning" title="Unofficial results:">
            this race has ended but hasn&apos;t been confirmed yet, so standings and prizes may still change.
          </Notice>
        )}
        <div className="pt-6">
          <Podium rows={rows} />
        </div>
        <LeaderboardTable
          rows={rows.slice(3)}
          caption={`${period.name} ${period.finalized ? "final" : "unofficial"} standings, 4th place and below`}
          emptyText={rows.length === 0 ? "Nobody wagered in this race." : "Only the players above took part in this race."}
        />
      </section>
    </div>
  );
}
