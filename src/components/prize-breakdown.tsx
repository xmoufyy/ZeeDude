import type { PlacePrize } from "@/lib/payouts";
import { formatSol } from "@/lib/sol";

const MEDAL = ["text-gold border-gold/40", "text-silver border-silver/30", "text-bronze border-bronze/30"];

// The payout split has no fixed length, so places can run past 20 ("21st", not "21th").
const ordinalRules = new Intl.PluralRules("en-US", { type: "ordinal" });
const SUFFIX: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" };
const ordinal = (n: number) => `${n}${SUFFIX[ordinalRules.select(n)] ?? "th"}`;

export function PrizeBreakdown({ prizes, poolSol }: { prizes: PlacePrize[]; poolSol: number }) {
  return (
    <section aria-labelledby="prizes-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="prizes-heading" className="section-title">
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
            <span className="label-caps">{ordinal(p.place)} place</span>
            <span className="font-display text-xl">{formatSol(p.sol)} SOL</span>
            <span className="text-xs text-muted">{p.percent}% of pool</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
