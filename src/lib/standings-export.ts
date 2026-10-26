// Admin leaderboard search and exports. Pure, so it can be unit tested and
// shared by the admin page (search) and the export route (files).

export type AdminStandingRow = {
  rank: number;
  /** Real username (admins only). */
  username: string;
  wageredSol: number;
  prizeSol: number;
  /** Ended periods: whether this place's prize is marked paid. */
  paid?: boolean;
  /** Payout wallet from an approved player profile. */
  wallet?: string;
  /** A player profile claims this username but isn't approved yet. */
  claimPending?: boolean;
};

/**
 * Search by username (case-insensitive, anywhere in the name) or by rank:
 * "5" or "#5" finds rank 5 as well as names containing "5".
 */
export function matchesStandingQuery(row: Pick<AdminStandingRow, "rank" | "username">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const rank = /^#?(\d+)$/.exec(q);
  if (rank && row.rank === Number(rank[1])) return true;
  return row.username.toLowerCase().includes(q.replace(/^#/, ""));
}

// Spreadsheet apps run cells that start with these as formulas; usernames come
// from imported files, so neutralise them (OWASP CSV injection guidance).
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number | boolean | undefined): string {
  if (value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV with a header row. `paid` is blank for live periods and for places without a prize. */
export function standingsCsv(rows: AdminStandingRow[]): string {
  const header = ["rank", "username", "wagered_sol", "prize_sol", "paid", "verified_wallet"];
  const lines = rows.map((r) =>
    [r.rank, r.username, r.wageredSol, r.prizeSol, r.paid === undefined ? undefined : r.paid ? "yes" : "no", r.wallet].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}

/** "Week of Oct 18" -> "week-of-oct-18", for download file names. */
export function exportFileStem(periodName: string): string {
  return (
    periodName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "period"
  );
}
