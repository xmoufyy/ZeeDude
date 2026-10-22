/** How much of a wager on each SolPump game counts toward the leaderboard. */
export const GAME_WEIGHTS: { game: string; percent: number }[] = [
  { game: "Crash", percent: 100 },
  { game: "Coinflip", percent: 100 },
  { game: "Keno", percent: 100 },
  { game: "Mines", percent: 100 },
  { game: "Blackjack", percent: 20 },
];
