"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatSol } from "@/lib/sol";
import { type AdminStandingRow, matchesStandingQuery } from "@/lib/standings-export";
import { CopyButton } from "./copy-button";

const PAGE = 100;

/**
 * Full real-name standings with search by username or rank. The query is kept
 * in the URL (?q=) so a refresh or a shared link keeps the same view.
 */
export function StandingsExplorer({ rows, locked, initialQuery = "" }: { rows: AdminStandingRow[]; locked: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [limit, setLimit] = useState(PAGE);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => rows.filter((r) => matchesStandingQuery(r, query)), [rows, query]);
  const visible = matches.slice(0, limit);

  // "/" jumps to the search box from anywhere on the page, like GitHub or Slack.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]");
      if (e.key !== "/" || e.metaKey || e.ctrlKey || typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function search(value: string) {
    setQuery(value);
    setLimit(PAGE);
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <label htmlFor="standings-search" className="field-label">
            Search username or rank
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="standings-search"
              type="search"
              value={query}
              onChange={(e) => search(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && query && (e.preventDefault(), search(""))}
              placeholder="Find a player, or #5"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="standings-count"
              className="input pr-10"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line px-1.5 text-xs text-muted" aria-hidden="true">
              /
            </kbd>
          </div>
        </div>
        <p id="standings-count" className="text-sm text-muted" aria-live="polite">
          {query.trim() ? `${matches.length} of ${rows.length} players match` : `${rows.length} ranked players`}
        </p>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <caption className="sr-only">Standings with real usernames</caption>
          <thead className="table-head">
            <tr>
              <th scope="col" className="w-16 px-4 py-3 font-semibold">Rank</th>
              <th scope="col" className="py-3 font-semibold">Player</th>
              <th scope="col" className="py-3 text-right font-semibold">Wagered</th>
              <th scope="col" className="py-3 pl-6 text-right font-semibold">Prize</th>
              {locked && <th scope="col" className="py-3 pl-6 font-semibold">Paid</th>}
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                <span className="sr-only">Copy</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr key={`${r.rank}-${r.username}`} className="hover:bg-white/[0.03]">
                <td className="px-4 py-2">
                  <span className={`rank-chip ${r.prizeSol > 0 ? "border-gold/25 text-gold-light" : ""}`}>{r.rank}</span>
                </td>
                <td className="py-2">
                  <span className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-magenta text-xs font-bold text-white" aria-hidden="true">
                      {Array.from(r.username)[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.username}</span>
                      {r.wallet ? (
                        <span className="badge badge-success mt-0.5" title={r.wallet}>
                          <span aria-hidden="true">✓</span> Verified wallet
                        </span>
                      ) : r.claimPending ? (
                        <span className="badge badge-neutral mt-0.5">
                          <span aria-hidden="true">◷</span> Profile claim pending
                        </span>
                      ) : null}
                    </span>
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums whitespace-nowrap">
                  {formatSol(r.wageredSol, { min: 2, max: 4 })} <span className="text-xs text-muted">SOL</span>
                </td>
                <td className="py-2 pl-6 text-right whitespace-nowrap tabular-nums">
                  {r.prizeSol > 0 ? <span className="text-gold">{formatSol(r.prizeSol)} SOL</span> : <span className="text-muted/60">—</span>}
                </td>
                {locked && (
                  <td className="py-2 pl-6">
                    {r.paid === undefined ? (
                      <span className="text-muted/60">—</span>
                    ) : r.paid ? (
                      <span className="badge badge-success">
                        <span aria-hidden="true">✓</span> Paid
                      </span>
                    ) : (
                      <span className="badge badge-warning">
                        <span aria-hidden="true">◷</span> Unpaid
                      </span>
                    )}
                  </td>
                )}
                <td className="px-4 py-2">
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <CopyButton value={r.username} label="Name" description={`username ${r.username}`} />
                    {r.wallet && <CopyButton value={r.wallet} label="Wallet" description={`${r.username}'s wallet address`} />}
                  </span>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={locked ? 6 : 5} className="px-4 py-8 text-center text-muted">
                  {rows.length === 0 ? (
                    "No wager data for this period yet."
                  ) : (
                    <>
                      No player matches “{query.trim()}”.{" "}
                      <button type="button" onClick={() => search("")} className="font-semibold text-cyan hover:underline">
                        Clear search
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {matches.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE * 5)}
            className="w-full border-t border-line py-3 text-sm font-semibold text-gold transition hover:bg-white/[0.03]"
          >
            Show more ({matches.length - limit} hidden)
          </button>
        )}
      </div>
    </div>
  );
}
