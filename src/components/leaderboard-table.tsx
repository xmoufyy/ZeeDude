"use client";

import { Fragment, useRef, useState } from "react";
import type { LeaderboardRow } from "@/lib/leaderboard";
import { formatSol } from "@/lib/sol";
import { GapNote, MoveBadge } from "./move-badge";
import { PaidBadge } from "./paid-badge";

const INITIAL_ROWS = 10;

/** Everyone after the podium (rank 4 onward). */
export function LeaderboardTable({
  rows,
  caption,
  emptyText = "No other players yet. Be the first to climb the board!",
}: {
  rows: LeaderboardRow[];
  caption: string;
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const visible = expanded ? rows : rows.slice(0, INITIAL_ROWS);
  const showPaid = rows.some((r) => r.paid !== undefined);

  if (rows.length === 0) {
    return <p className="panel px-5 py-8 text-center text-muted">{emptyText}</p>;
  }

  function toggle() {
    // Collapsing a long list would leave the reader far below it, so bring the table back into view.
    if (expanded && panelRef.current && panelRef.current.getBoundingClientRect().top < 0) {
      panelRef.current.scrollIntoView({ block: "start" });
    }
    setExpanded((e) => !e);
  }

  return (
    <div ref={panelRef} className="panel overflow-hidden">
      <table className="w-full text-left text-sm sm:text-base">
        <caption className="sr-only">{caption}</caption>
        <thead className="table-head">
          <tr>
            <th scope="col" className="w-14 py-3 pl-3 font-semibold sm:w-24 sm:pl-6">Rank</th>
            <th scope="col" className="py-3 font-semibold">Player</th>
            {/* w-px: number columns shrink to their content, so names get the spare width. */}
            <th scope="col" className="w-px py-3 pl-2 text-right font-semibold">Wagered</th>
            <th scope="col" className="w-px py-3 pr-3 pl-3 text-right font-semibold sm:pr-6 sm:pl-6">Prize</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {visible.map((row, i) => {
            const paidPlace = row.prizeSol > 0;
            // A marker after the last paid place, so the cutoff is visible at a glance.
            const cutoffAfter = paidPlace && visible[i + 1] !== undefined && visible[i + 1].prizeSol === 0;
            return (
              <Fragment key={`${row.rank}-${row.name}-${i}`}>
                <tr className={`transition-colors hover:bg-white/[0.03] ${paidPlace ? "bg-gold/[0.025]" : ""}`}>
                  <td className={`relative py-3 pl-3 sm:pl-6 ${paidPlace ? "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-gold/60" : ""}`}>
                    {/* On phones the climb arrow sits under the rank, leaving the name column room for the whole masked name. */}
                    <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
                      <span className={`rank-chip ${paidPlace ? "border-gold/25 text-gold-light" : ""}`}>{row.rank}</span>
                      <MoveBadge move={row.move} />
                    </span>
                  </td>
                  <td className="max-w-0 py-3 pr-2 sm:max-w-none">
                    <span className="block truncate font-medium">{row.name}</span>
                    <GapNote gapSol={row.gapSol} gapRank={row.gapRank} className="block truncate" />
                  </td>
                  <td className="py-3 pl-2 text-right tabular-nums whitespace-nowrap">
                    {formatSol(row.wageredSol, { min: 2, max: 2 })}
                    <span className="ml-1 text-xs text-muted">SOL</span>
                  </td>
                  <td className="py-3 pr-3 pl-3 text-right whitespace-nowrap sm:pr-6 sm:pl-6">
                    {paidPlace ? (
                      <span className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                        {showPaid && row.paid !== undefined && <PaidBadge paid={row.paid} className="hidden sm:inline-flex" />}
                        <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 font-semibold text-gold tabular-nums">
                          {formatSol(row.prizeSol)} SOL
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted/60" aria-label="No prize">—</span>
                    )}
                  </td>
                </tr>
                {cutoffAfter && (
                  <tr aria-hidden="true">
                    <td colSpan={4} className="px-3 py-1.5 sm:px-6">
                      <span className="flex items-center gap-3 text-[0.65rem] font-semibold tracking-widest text-gold/80 uppercase">
                        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
                        Prize places end here
                        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
                      </span>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length > INITIAL_ROWS && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className="w-full border-t border-line py-3 text-sm font-semibold text-gold transition hover:bg-white/[0.03] active:bg-white/[0.05]"
        >
          {expanded ? "Show less" : `Show all ${rows.length + 3} players`}
        </button>
      )}
    </div>
  );
}
