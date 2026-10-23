"use client";

import { useState } from "react";
import type { LeaderboardRow } from "@/lib/leaderboard";
import { formatSol } from "@/lib/sol";
import { GapNote, MoveBadge } from "./move-badge";
import { PaidBadge } from "./paid-badge";

const INITIAL_ROWS = 10;

/** Everyone after the podium (rank 4 onward). */
export function LeaderboardTable({ rows, caption }: { rows: LeaderboardRow[]; caption: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, INITIAL_ROWS);
  const showPaid = rows.some((r) => r.paid !== undefined);

  if (rows.length === 0) {
    return <p className="panel px-5 py-8 text-center text-muted">No other players yet. Be the first to climb the board!</p>;
  }

  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left text-sm sm:text-base">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-[0.7rem] tracking-widest text-muted uppercase sm:text-xs">
          <tr>
            <th scope="col" className="w-20 py-3 pl-3 font-semibold sm:w-24 sm:pl-6">Rank</th>
            <th scope="col" className="py-3 font-semibold">Player</th>
            <th scope="col" className="py-3 text-right font-semibold">Wagered</th>
            <th scope="col" className="py-3 pr-3 text-right font-semibold sm:pr-6">Prize</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {visible.map((row, i) => (
            <tr key={`${row.rank}-${row.name}-${i}`} className="transition-colors hover:bg-white/[0.03]">
              <td className="py-3 pl-3 sm:pl-6">
                <span className="flex items-center gap-1.5">
                  <span className="inline-grid size-8 place-items-center rounded-lg bg-white/5 font-display text-sm text-muted">
                    {row.rank}
                  </span>
                  <MoveBadge move={row.move} />
                </span>
              </td>
              <td className="max-w-0 py-3 pr-2 sm:max-w-none">
                <span className="block truncate font-medium">{row.name}</span>
                <GapNote gapSol={row.gapSol} gapRank={row.gapRank} className="block truncate" />
              </td>
              <td className="py-3 text-right tabular-nums whitespace-nowrap">
                {formatSol(row.wageredSol, { min: 2, max: 2 })}
                <span className="ml-1 text-xs text-muted">SOL</span>
              </td>
              <td className="py-3 pr-3 text-right whitespace-nowrap sm:pr-6">
                {row.prizeSol > 0 ? (
                  <span className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                    {showPaid && row.paid !== undefined && <PaidBadge paid={row.paid} className="hidden sm:inline-flex" />}
                    <span className="rounded-full bg-gold/10 px-2.5 py-1 font-semibold text-gold tabular-nums">
                      {formatSol(row.prizeSol)} SOL
                    </span>
                  </span>
                ) : (
                  <span className="text-muted/60" aria-label="No prize">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > INITIAL_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="w-full border-t border-line py-3 text-sm font-semibold text-gold transition hover:bg-white/[0.03]"
        >
          {expanded ? "Show less" : `Show all ${rows.length + 3} players`}
        </button>
      )}
    </div>
  );
}
