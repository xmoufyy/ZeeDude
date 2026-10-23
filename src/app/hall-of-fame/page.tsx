import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DelayedNotice } from "@/components/delayed-notice";
import type { HallOfFameRow } from "@/lib/leaderboard";
import { formatPeriodRange } from "@/lib/period";
import { loadHallOfFame } from "@/lib/public-data";
import { formatSol } from "@/lib/sol";

export const metadata: Metadata = {
  title: "Hall of Fame",
  description: "All-time legends of the ZeeDude SolPump wager race: most wins, most SOL won and the biggest weeks.",
};

export default function HallOfFamePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pt-8 sm:pt-12">
      <header className="space-y-2">
        <h1 className="font-display text-3xl sm:text-5xl">
          Hall of <span className="text-gold-gradient">Fame</span> <span aria-hidden="true">🏆</span>
        </h1>
        <p className="max-w-2xl text-muted">The legends of the ZeeDude race, counted across every finished week.</p>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/5" />}>
        <Hall />
      </Suspense>
    </div>
  );
}

async function Hall() {
  // Request time only, so the database is never hit during the build.
  await connection();
  const loaded = await loadHallOfFame();
  const hall = loaded.value;

  if (hall.races === 0 || hall.rows.length === 0) {
    return (
      <p className="panel px-5 py-10 text-center text-muted">
        No legends yet. The first champion is crowned when this week&apos;s race ends.{" "}
        <Link href="/" className="text-gold underline underline-offset-4">
          See the live race
        </Link>
      </p>
    );
  }

  const records = [
    { icon: "👑", label: "Most race wins", row: best(hall.rows, (r) => r.wins), value: (r: HallOfFameRow) => `${r.wins} ${r.wins === 1 ? "win" : "wins"}` },
    { icon: "💰", label: "Most SOL won", row: best(hall.rows, (r) => r.wonSol), value: (r: HallOfFameRow) => `${formatSol(r.wonSol)} SOL` },
    { icon: "🐋", label: "Biggest single week", row: best(hall.rows, (r) => r.bestWeekSol), value: (r: HallOfFameRow) => `${formatSol(r.bestWeekSol, { max: 2 })} SOL wagered` },
  ];

  return (
    <div className="space-y-12">
      {loaded.fromFallback && <DelayedNotice freshness={{ delayed: true, reason: "database", since: loaded.savedAt }} />}

      <section aria-labelledby="records-heading" className="space-y-4">
        <h2 id="records-heading" className="sr-only">Records</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {records.map(({ icon, label, row, value }) => (
            <li key={label} className="panel space-y-1 p-5">
              <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">
                <span aria-hidden="true">{icon}</span> {label}
              </p>
              <p className="truncate font-display text-2xl text-gold">{row.name}</p>
              <p className="text-sm text-muted">{value(row)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="champions-heading" className="space-y-4">
        <h2 id="champions-heading" className="font-display text-2xl">
          Recent <span className="text-gold-gradient">Champions</span>
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {hall.champions.map((c) => (
            <li key={`${c.endsAt}-${c.name}`} className="panel flex flex-col gap-1 p-4">
              <span className="text-xs text-muted">{formatPeriodRange(c.startsAt, c.endsAt)}</span>
              <span className="truncate font-semibold">
                <span aria-hidden="true">👑 </span>
                {c.name}
              </span>
              <span className="text-sm text-muted">
                {formatSol(c.wageredSol, { max: 2 })} SOL wagered · <span className="text-gold">{formatSol(c.prizeSol)} SOL won</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="alltime-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="alltime-heading" className="font-display text-2xl">
            All-Time <span className="text-gold-gradient">Leaders</span>
          </h2>
          <p className="text-sm text-muted">
            {hall.races} {hall.races === 1 ? "race" : "races"} counted
          </p>
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm sm:text-base">
            <caption className="sr-only">All-time leaders by SOL won</caption>
            <thead className="border-b border-line text-[0.7rem] tracking-widest text-muted uppercase sm:text-xs">
              <tr>
                <th scope="col" className="w-14 py-3 pl-3 font-semibold sm:pl-6">#</th>
                <th scope="col" className="py-3 font-semibold">Player</th>
                <th scope="col" className="py-3 text-right font-semibold">Wins</th>
                <th scope="col" className="py-3 text-right font-semibold">Top 3</th>
                <th scope="col" className="py-3 text-right font-semibold">Wagered</th>
                <th scope="col" className="py-3 pr-3 text-right font-semibold sm:pr-6">Won</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {hall.rows.slice(0, 50).map((r, i) => (
                <tr key={`${i}-${r.name}`} className="transition-colors hover:bg-white/[0.03]">
                  <td className="py-3 pl-3 sm:pl-6">
                    <span className="inline-grid size-8 place-items-center rounded-lg bg-white/5 font-display text-sm text-muted">{i + 1}</span>
                  </td>
                  <td className="max-w-48 truncate py-3 pr-2 font-medium">
                    {r.name}
                    <span className="ml-2 text-xs text-muted">
                      {r.races} {r.races === 1 ? "race" : "races"}
                    </span>
                  </td>
                  <td className="py-3 text-right tabular-nums">{r.wins > 0 ? `👑 ${r.wins}` : "—"}</td>
                  <td className="py-3 text-right tabular-nums">{r.podiums || "—"}</td>
                  <td className="py-3 text-right tabular-nums whitespace-nowrap">
                    {formatSol(r.wageredSol, { max: 2 })}
                    <span className="ml-1 text-xs text-muted">SOL</span>
                  </td>
                  <td className="py-3 pr-3 text-right whitespace-nowrap sm:pr-6">
                    {r.wonSol > 0 ? (
                      <span className="rounded-full bg-gold/10 px-2.5 py-1 font-semibold text-gold tabular-nums">{formatSol(r.wonSol)} SOL</span>
                    ) : (
                      <span className="text-muted/60">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** The row with the highest value (first in table order on ties). */
function best(rows: HallOfFameRow[], value: (r: HallOfFameRow) => number): HallOfFameRow {
  return rows.reduce((top, r) => (value(r) > value(top) ? r : top), rows[0]);
}
