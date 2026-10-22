import { GAME_WEIGHTS } from "@/lib/game-weights";

/** "Rules" pill that opens a small panel showing how each game's wagers count. No JS needed. */
export function GameRules() {
  return (
    <details className="group relative shrink-0">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-panel-2/80 px-4 py-2 text-sm font-semibold text-text transition-colors select-none hover:border-gold/50 hover:text-gold [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 21h11a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
          <path d="M19 17V5a2 2 0 0 0-2-2H4" />
          <path d="M15 8h-5M15 12h-5" />
        </svg>
        Rules
      </summary>
      <div className="panel absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 p-4 shadow-2xl shadow-black/60">
        <p className="text-sm font-semibold">How wagers count</p>
        <ul className="divide-y divide-line text-sm">
          {GAME_WEIGHTS.map(({ game, percent }) => (
            <li key={game} className="flex items-center justify-between py-2">
              <span>{game}</span>
              <span className={percent === 100 ? "font-semibold text-cyan" : "font-semibold text-gold"}>{percent}%</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Example: a 10 SOL Blackjack bet adds 2 SOL to your total.</p>
      </div>
    </details>
  );
}
