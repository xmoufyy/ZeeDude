import type { Move } from "@/lib/board-stats";
import { formatSol } from "@/lib/sol";

/** ▲2 / ▼1 / NEW since the previous standings. Renders nothing when unchanged or unknown. */
export function MoveBadge({ move, className = "" }: { move?: Move; className?: string }) {
  if (move === undefined || move === 0) return null;
  if (move === "new") {
    return (
      <span className={`rounded bg-magenta/15 px-1 text-[0.6rem] font-bold tracking-wider text-magenta ${className}`} title="New on the board">
        NEW
      </span>
    );
  }
  const up = move > 0;
  return (
    <span
      className={`text-xs font-bold tabular-nums ${up ? "text-emerald-300" : "text-red-300"} ${className}`}
      title={`${up ? "Up" : "Down"} ${Math.abs(move)} since the last update`}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "up" : "down"} </span>
      {Math.abs(move)}
    </span>
  );
}

/** "0.80 SOL behind #3". Renders nothing for the leader. */
export function GapNote({ gapSol, gapRank, className = "" }: { gapSol?: number; gapRank?: number; className?: string }) {
  if (gapSol === undefined || gapRank === undefined) return null;
  return (
    <span className={`text-xs text-muted ${className}`}>
      {formatSol(gapSol, { min: 2, max: 2 })} SOL behind #{gapRank}
    </span>
  );
}
