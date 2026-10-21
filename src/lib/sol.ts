// All prize math runs in integer lamports (1 SOL = 1e9 lamports) so splits
// never drift from floating-point error. Amounts are stored as SOL floats.

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/** "12.3456" style: up to `max` decimals, trailing zeros trimmed, at least `min`. */
export function formatSol(sol: number, { min = 0, max = 4 } = {}): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(sol);
}
