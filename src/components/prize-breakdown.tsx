import type { PlacePrize } from "@/lib/payouts";
import { formatSol } from "@/lib/sol";

const MEDAL = ["text-gold border-gold/40", "text-silver border-silver/30", "text-bronze border-bronze/30"];

export function PrizeBreakdown({ prizes, poolSol }: { prizes: PlacePrize[]; poolSol: number }) {
  return (
    <section aria-labelledby="prizes-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="prizes-heading" className="font-display text-2xl sm:text-3xl">
          Prize <span className="text-gold-gradient">Breakdown</span>
        </h2>
        <p className="text-muted">
          <span className="font-semibold text-text">{formatSol(poolSol)} SOL</span> paid to the top {prizes.length}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {prizes.map((p) => (
          <li
            key={p.place}
            className={`panel flex flex-col gap-1 px-4 py-3 ${p.place <= 3 ? `border ${MEDAL[p.place - 1]}` : "text-text"}`}
          >
            <span className="text-xs font-semibold tracking-widest text-muted uppercase">
              {p.place === 1 ? "1st" : p.place === 2 ? "2nd" : p.place === 3 ? "3rd" : `${p.place}th`} place
            </span>
            <span className="font-display text-xl">{formatSol(p.sol)} SOL</span>
            <span className="text-xs text-muted">{p.percent}% of pool</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
