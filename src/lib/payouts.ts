import type { RankedEntry } from "./ranking";
import { lamportsToSol, solToLamports } from "./sol";

export type PlacePrize = {
  place: number;
  percent: number;
  lamports: number;
  sol: number;
};

export type PrizedEntry = RankedEntry & {
  prizeLamports: number;
  prizeSol: number;
};

/** True when every share is a positive number and they add up to 100%. */
export function isValidSplit(split: readonly number[]): boolean {
  if (split.length === 0) return false;
  if (split.some((p) => !Number.isFinite(p) || p <= 0)) return false;
  const total = split.reduce((sum, p) => sum + p, 0);
  return Math.abs(total - 100) < 1e-6;
}

/**
 * Splits a pool into per-place prizes using the largest-remainder method so
 * the prizes always add up to exactly the pool, down to the lamport.
 */
export function computePlacePrizes(poolSol: number, split: readonly number[]): PlacePrize[] {
  if (!isValidSplit(split)) throw new Error("Payout split must be positive and total 100%");
  const poolLamports = solToLamports(poolSol);
  if (poolLamports < 0) throw new Error("Prize pool cannot be negative");

  const exact = split.map((percent) => (poolLamports * percent) / 100);
  const lamports = exact.map(Math.floor);
  let leftover = poolLamports - lamports.reduce((sum, l) => sum + l, 0);

  // Hand out the remaining lamports to the places with the biggest fractional
  // part; ties go to the better place.
  const order = exact
    .map((value, i) => ({ i, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (leftover <= 0) break;
    lamports[i] += 1;
    leftover -= 1;
  }

  return split.map((percent, i) => ({
    place: i + 1,
    percent,
    lamports: lamports[i],
    sol: lamportsToSol(lamports[i]),
  }));
}

/**
 * Attaches prizes to ranked players. Tied players share the combined prize of
 * every position they occupy, split evenly; any lamport left over from the
 * division goes to the tied players in display order, one each.
 */
export function assignPrizes(
  ranked: readonly RankedEntry[],
  placePrizes: readonly PlacePrize[],
): PrizedEntry[] {
  const prizeAt = (position: number) => placePrizes[position]?.lamports ?? 0;
  const result: PrizedEntry[] = [];

  let start = 0;
  while (start < ranked.length) {
    let end = start;
    while (end + 1 < ranked.length && ranked[end + 1].rank === ranked[start].rank) end++;

    const group = ranked.slice(start, end + 1);
    let pot = 0;
    for (let p = start; p <= end; p++) pot += prizeAt(p);

    const share = Math.floor(pot / group.length);
    let remainder = pot - share * group.length;
    for (const entry of group) {
      const prizeLamports = share + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      result.push({ ...entry, prizeLamports, prizeSol: lamportsToSol(prizeLamports) });
    }
    start = end + 1;
  }
  return result;
}
