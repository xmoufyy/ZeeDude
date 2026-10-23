import { maskUsername } from "./mask";

type Board = { rows: { name: string }[]; masked: boolean } | null;

/**
 * Masks every name in a leaderboard before it's kept as an outage fallback.
 * Fails closed: if a player later turns on "hide my name" (or an admin turns
 * masking on), an old fallback copy can't reveal their full name.
 * maskUsername is stable on already-masked names, so masked rows stay as they are.
 */
export function maskBoardForFallback<T extends Board>(board: T): T {
  if (!board) return board;
  return { ...board, masked: true, rows: board.rows.map((row) => ({ ...row, name: maskUsername(row.name) })) };
}

type Hall = { rows: { name: string }[]; champions: { name: string }[]; masked: boolean };

/** The Hall of Fame's fallback copy, with every name masked (same reasoning as above). */
export function maskHallForFallback<T extends Hall>(hall: T): T {
  return {
    ...hall,
    masked: true,
    rows: hall.rows.map((row) => ({ ...row, name: maskUsername(row.name) })),
    champions: hall.champions.map((c) => ({ ...c, name: maskUsername(c.name) })),
  };
}
