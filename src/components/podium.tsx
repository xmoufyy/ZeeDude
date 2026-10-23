import type { LeaderboardRow } from "@/lib/leaderboard";
import type { PlacePrize } from "@/lib/payouts";
import { formatSol } from "@/lib/sol";
import { CountUp } from "./count-up";
import { GapNote, MoveBadge } from "./move-badge";
import { PaidBadge } from "./paid-badge";

const PLACES = [
  // Display order is 2-1-3 so 1st sits in the middle and highest.
  { index: 1, order: "order-1", lift: "mt-8 sm:mt-10", ring: "ring-silver/50", text: "text-silver", chip: "from-silver to-[#9aa3b5]", delay: 150, glow: "" },
  { index: 0, order: "order-2", lift: "", ring: "ring-gold/70", text: "text-gold", chip: "from-gold-light to-gold-deep", delay: 0, glow: "animate-glow" },
  { index: 2, order: "order-3", lift: "mt-12 sm:mt-14", ring: "ring-bronze/50", text: "text-bronze", chip: "from-bronze to-[#a85a28]", delay: 300, glow: "" },
];

function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true">
      <path
        d="M4 34 L8 10 L22 22 L32 4 L42 22 L56 10 L60 34 Z"
        fill="url(#crown)"
        stroke="#7a3d00"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="9" r="3.5" fill="#ffe8a3" />
      <circle cx="32" cy="4" r="3.5" fill="#ffe8a3" />
      <circle cx="56" cy="9" r="3.5" fill="#ffe8a3" />
      <defs>
        <linearGradient id="crown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.5" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#d07a00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Top 3. Pass `placePrizes` for a live race so empty spots show what the place
 * pays ("up for grabs"); on finished races an empty spot won nothing.
 */
export function Podium({ rows, placePrizes }: { rows: LeaderboardRow[]; placePrizes?: PlacePrize[] }) {
  return (
    <ol className="grid grid-cols-3 items-start gap-2 sm:gap-5" aria-label="Top 3 players">
      {PLACES.map((place) => {
        const row = rows[place.index];
        const first = place.index === 0;
        const openPrize = row ? undefined : placePrizes?.[place.index]?.sol;
        return (
          <li
            key={place.index}
            className={`${place.order} ${place.lift} animate-rise`}
            style={{ animationDelay: `${place.delay}ms` }}
          >
            <article
              className={`panel relative flex flex-col items-center px-2 pt-8 pb-4 text-center sm:px-5 sm:pt-10 sm:pb-6 ${place.glow} ${
                first ? "bg-gradient-to-b from-violet/30 to-panel" : ""
              }`}
            >
              {first && <Crown className="absolute -top-6 h-10 w-14 drop-shadow-[0_4px_12px_rgb(255_200_61/0.5)] sm:-top-7 sm:h-12 sm:w-18" />}
              <div
                className={`grid size-14 place-items-center rounded-full bg-gradient-to-br from-violet to-magenta font-display text-2xl text-white ring-4 sm:size-20 sm:text-3xl ${place.ring}`}
                aria-hidden="true"
              >
                {row ? Array.from(row.name)[0]?.toUpperCase() : "?"}
              </div>
              <span
                className={`-mt-3 rounded-full bg-gradient-to-b px-2.5 py-0.5 font-display text-sm text-ink shadow sm:text-base ${place.chip}`}
              >
                <span className="sr-only">Rank </span>#{row?.rank ?? place.index + 1}
              </span>
              <MoveBadge move={row?.move} className="mt-1" />
              <h3 className="mt-3 w-full truncate text-sm font-semibold sm:text-lg">
                {row?.name ?? "Open spot"}
              </h3>
              <p className="mt-2 text-[0.65rem] font-semibold tracking-widest text-muted uppercase sm:text-xs">Wagered</p>
              <p className="font-display text-sm text-text sm:text-xl">
                {row ? <CountUp value={row.wageredSol} delayMs={place.delay + 300} decimals={2} /> : "0"}
                <span className="ml-1 font-sans text-[0.65rem] font-semibold text-muted sm:text-xs">SOL</span>
              </p>
              <GapNote gapSol={row?.gapSol} gapRank={row?.gapRank} className="mt-0.5 hidden sm:block" />
              <div className={`mt-3 w-full rounded-xl border border-current/30 bg-current/5 px-2 py-1.5 sm:py-2 ${place.text}`}>
                <p className="text-[0.6rem] font-semibold tracking-widest uppercase opacity-80 sm:text-[0.7rem]">
                  {openPrize ? "Up for grabs" : "Prize"}
                </p>
                <p className="font-display text-base sm:text-2xl">
                  {formatSol(row?.prizeSol ?? openPrize ?? 0)}
                  <span className="ml-1 font-sans text-xs font-semibold">SOL</span>
                </p>
              </div>
              {row?.paid !== undefined && <PaidBadge paid={row.paid} className="mt-3" />}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
