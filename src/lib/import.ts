import { z } from "zod";
import { normalizeUsername } from "./ranking";

// Parses wager exports (CSV or JSON) into validated rows. Column names are
// matched loosely so exports with headers like "Player", "Wagered (SOL)" or
// "total_wagered" all work without editing the file first.

export type ImportRow = { username: string; wageredSol: number; wageredUsd?: number };

export type ParseResult =
  | { ok: true; rows: ImportRow[]; duplicatesMerged: number; skippedBlank: number }
  | { ok: false; errors: string[] };

export const MAX_IMPORT_ROWS = 10_000;
const MAX_ERRORS_SHOWN = 10;

const COLUMN_ALIASES = {
  username: ["username", "user", "name", "player", "playername", "account", "handle", "referral", "referee"],
  wageredSol: ["wageredsol", "wagered", "wager", "wagersol", "totalwagered", "totalwageredsol", "totalwager", "volume", "volumesol", "sol", "amount", "wageramount"],
  wageredUsd: ["wageredusd", "wagerusd", "usd", "volumeusd", "totalwageredusd", "wagered$"],
} as const;

type Column = keyof typeof COLUMN_ALIASES;

const normalizeHeader = (h: string) => h.toLowerCase().replace(/\(.*?\)/g, (m) => m.replace(/[()]/g, "")).replace(/[^a-z0-9$]/g, "");

function findColumns(headers: string[]): Partial<Record<Column, number>> {
  const normalized = headers.map(normalizeHeader);
  const found: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(COLUMN_ALIASES) as Column[]) {
    const index = normalized.findIndex((h) => (COLUMN_ALIASES[column] as readonly string[]).includes(h));
    if (index !== -1) found[column] = index;
  }
  return found;
}

/** "1,234.5 SOL", "◎ 12", "$99.10" -> number. Empty -> undefined. */
export function parseAmount(raw: unknown): number | undefined {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return raw == null ? undefined : Number.NaN;
  const cleaned = raw.replace(/sol|usd|[◎$,\s]/gi, "");
  if (cleaned === "") return undefined;
  return /^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(cleaned) ? Number(cleaned) : Number.NaN;
}

const rowSchema = z.object({
  username: z
    .string()
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim())
    .pipe(z.string().min(1, "username is empty").max(64, "username is longer than 64 characters")),
  wageredSol: z
    .number({ invalid_type_error: "wagered SOL is not a number", required_error: "wagered SOL is missing" })
    .finite("wagered SOL is not a number")
    .nonnegative("wagered SOL can't be negative")
    .max(1e9, "wagered SOL is unrealistically large"),
  wageredUsd: z.number().finite("wagered USD is not a number").nonnegative("wagered USD can't be negative").optional(),
});

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, and ; or tab delimiters. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/, "");
  const firstLine = input.slice(0, input.search(/\r?\n|$/));
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type RawRecord = { line: number; username: unknown; wageredSol: unknown; wageredUsd: unknown };

function csvRecords(text: string): { records: RawRecord[] } | { error: string } {
  const [headers, ...rows] = parseCsv(text);
  if (!headers) return { error: "The file is empty." };
  const cols = findColumns(headers);
  if (cols.username === undefined || cols.wageredSol === undefined) {
    return {
      error: `Couldn't find the columns. Need a username column (e.g. "username") and a wager column (e.g. "wagered"). Found: ${headers.join(", ")}`,
    };
  }
  return {
    records: rows.map((cells, i) => ({
      line: i + 2,
      username: cells[cols.username!] ?? "",
      wageredSol: cells[cols.wageredSol!],
      wageredUsd: cols.wageredUsd === undefined ? undefined : cells[cols.wageredUsd],
    })),
  };
}

function jsonRecords(text: string): { records: RawRecord[] } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "The file isn't valid JSON." };
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    data = obj.entries ?? obj.data ?? obj.players ?? obj.leaderboard ?? obj.rows;
  }
  if (!Array.isArray(data)) {
    return { error: 'Expected a JSON array of players, or an object with an "entries" array.' };
  }
  return {
    records: data.map((item, i) => {
      if (!item || typeof item !== "object") return { line: i + 1, username: undefined, wageredSol: undefined, wageredUsd: undefined };
      const entries = Object.entries(item as Record<string, unknown>);
      const cols = findColumns(entries.map(([k]) => k));
      const pick = (c: Column) => (cols[c] === undefined ? undefined : entries[cols[c]!][1]);
      return { line: i + 1, username: pick("username"), wageredSol: pick("wageredSol"), wageredUsd: pick("wageredUsd") };
    }),
  };
}

export function parseWagerFile(text: string, format: "csv" | "json"): ParseResult {
  const parsed = format === "json" ? jsonRecords(text) : csvRecords(text);
  if ("error" in parsed) return { ok: false, errors: [parsed.error] };

  const errors: string[] = [];
  const merged = new Map<string, ImportRow>();
  let duplicatesMerged = 0;
  let skippedBlank = 0;
  const label = format === "json" ? "Item" : "Line";

  const nonBlank = parsed.records.filter((r) => {
    const blank = (r.username === undefined || r.username === "") && (r.wageredSol === undefined || r.wageredSol === "");
    if (blank) skippedBlank++;
    return !blank;
  });
  if (nonBlank.length > MAX_IMPORT_ROWS) {
    return { ok: false, errors: [`Too many rows (${nonBlank.length}). The limit is ${MAX_IMPORT_ROWS}.`] };
  }

  for (const record of nonBlank) {
    const result = rowSchema.safeParse({
      username: typeof record.username === "number" ? String(record.username) : record.username,
      wageredSol: parseAmount(record.wageredSol),
      wageredUsd: parseAmount(record.wageredUsd),
    });
    if (!result.success) {
      errors.push(`${label} ${record.line}: ${result.error.issues.map((i) => i.message).join(", ")}`);
      continue;
    }
    const row = result.data;
    const key = normalizeUsername(row.username);
    const existing = merged.get(key);
    if (existing) {
      // Same player twice (e.g. a per-day export): add the totals together.
      duplicatesMerged++;
      existing.wageredSol += row.wageredSol;
      if (row.wageredUsd !== undefined) existing.wageredUsd = (existing.wageredUsd ?? 0) + row.wageredUsd;
    } else {
      merged.set(key, { ...row });
    }
  }

  if (errors.length > 0) {
    const shown = errors.slice(0, MAX_ERRORS_SHOWN);
    if (errors.length > MAX_ERRORS_SHOWN) shown.push(`...and ${errors.length - MAX_ERRORS_SHOWN} more problems.`);
    return { ok: false, errors: shown };
  }
  if (merged.size === 0) return { ok: false, errors: ["No player rows found in the file."] };

  return { ok: true, rows: [...merged.values()], duplicatesMerged, skippedBlank };
}
