// SolPump's affiliate page lists each referral's ALL-TIME wagered total. The
// admin copies that list into the site now and then ("snapshots"); a period's
// wager for a player is their latest total minus their total in the snapshot
// taken closest to the period's start. Pure functions, no database access.

import { parseAmount } from "./import";
import { normalizeUsername } from "./ranking";
import { lamportsToSol, solToLamports } from "./sol";

export const MAX_AFFILIATE_ROWS = 10_000;
/** A snapshot this close to a period boundary counts as taken at the boundary. */
export const BOUNDARY_GRACE_MS = 60 * 60 * 1000;

export type AffiliateRow = { username: string; lifetimeSol: number };
export type AffiliateParse = { rows: AffiliateRow[]; warnings: string[]; errors: string[] };

const NUMBER = /^[◎$\s]*-?[\d,]*\.?\d+\s*(sol)?$/i;
const DATE = /\d{1,2}\/\d{1,2}\/\d{2,4}/;
const LABEL = /^(wagered|comm?iss?ion|generated|first seen|last seen)\b/i;
// Verified ticks and similar marks the page shows after a name.
const TRAILING_MARKS = /[\s✓✔☑✅︎️]+$/u;

function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(TRAILING_MARKS, "").trim();
}

/**
 * Reads text copied from SolPump's affiliate page. Each player appears as a
 * name followed by "Wagered <amount>" (on one line or two); everything else
 * (commission, dates, avatars) is ignored. Falls back to simple "name, amount"
 * lines when there are no "Wagered" labels at all.
 */
export function parseAffiliatePaste(text: string): AffiliateParse {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const found: { line: number; name: string; amount: string }[] = [];
  const errors: string[] = [];

  let lastName: { text: string; line: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const labelled = /^(?:(.*?)\s+)?wagered\s*:?\s*(.*)$/i.exec(line);
    if (labelled) {
      const name = labelled[1]?.trim() ? labelled[1] : lastName?.text;
      let amount = labelled[2].trim();
      if (!amount && i + 1 < lines.length && NUMBER.test(lines[i + 1])) amount = lines[++i];
      if (!name) errors.push(`Line ${i + 1}: found "Wagered" with no player name before it.`);
      else found.push({ line: i + 1, name, amount });
      lastName = null;
      continue;
    }
    if (!NUMBER.test(line) && !DATE.test(line) && !LABEL.test(line)) lastName = { text: line, line: i + 1 };
  }

  if (found.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const plain = /^(.+?)(?:\s*[,;\t]\s*|\s{2,})([◎$]?\s*[\d,]*\.?\d+)\s*(sol)?$/i.exec(lines[i]);
      if (plain) found.push({ line: i + 1, name: plain[1], amount: plain[2] });
    }
  }

  const byKey = new Map<string, AffiliateRow>();
  const warnings: string[] = [];
  for (const { line, name, amount } of found) {
    const username = cleanName(name);
    const lifetimeSol = parseAmount(amount);
    if (!username || username.length > 64) {
      errors.push(`Line ${line}: "${name.slice(0, 40)}" isn't a valid username.`);
      continue;
    }
    if (lifetimeSol === undefined || !Number.isFinite(lifetimeSol) || lifetimeSol < 0 || lifetimeSol > 1e9) {
      errors.push(`Line ${line}: couldn't read the wagered amount for ${username}.`);
      continue;
    }
    const key = normalizeUsername(username);
    const seen = byKey.get(key);
    if (seen) {
      // The same page copied twice gives identical rows; keep the larger total otherwise.
      if (seen.lifetimeSol !== lifetimeSol) warnings.push(`${username} appears twice with different totals; using the larger one.`);
      if (lifetimeSol > seen.lifetimeSol) byKey.set(key, { username, lifetimeSol });
      continue;
    }
    byKey.set(key, { username, lifetimeSol });
  }

  const rows = [...byKey.values()];
  if (rows.length === 0 && errors.length === 0) {
    errors.push('No players found. Copy the whole list from SolPump\'s affiliate page (names with their "Wagered" amounts) and paste it here.');
  }
  if (rows.length > MAX_AFFILIATE_ROWS) errors.push(`Too many players (${rows.length}); the limit is ${MAX_AFFILIATE_ROWS}.`);
  return { rows, warnings, errors };
}

export type SnapshotRef = { id: string; takenAt: Date };
export type PeriodWindow = { startsAt: Date; endsAt: Date };

/**
 * Which snapshots to compare for a period: the latest one taken before the
 * period ended (plus grace), against the one taken closest to its start.
 * Returns nulls when there's nothing to compare yet.
 */
export function pickSnapshots<T extends SnapshotRef>(
  snapshots: T[],
  period: PeriodWindow,
): { latest: T | null; baseline: T | null; baselineOffMs: number | null } {
  const endLimit = period.endsAt.getTime() + BOUNDARY_GRACE_MS;
  const start = period.startsAt.getTime();
  const sorted = [...snapshots].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
  const usable = sorted.filter((s) => s.takenAt.getTime() <= endLimit);
  const latest = usable.at(-1) ?? null;
  if (!latest || latest.takenAt.getTime() < start - BOUNDARY_GRACE_MS) return { latest: null, baseline: null, baselineOffMs: null };

  let baseline: T | null = null;
  for (const s of usable) {
    if (s === latest) break;
    if (!baseline || Math.abs(s.takenAt.getTime() - start) < Math.abs(baseline.takenAt.getTime() - start)) baseline = s;
  }
  return { latest, baseline, baselineOffMs: baseline ? baseline.takenAt.getTime() - start : null };
}

export type WeeklyRow = { username: string; wageredSol: number; lifetimeSol: number };

/**
 * Each player's wager since the baseline. Players missing from the baseline
 * joined since then, so their whole total counts. Rows that went down
 * (shouldn't happen with all-time totals) count as zero.
 */
export function weeklyTotals(latest: AffiliateRow[], baseline: AffiliateRow[]): { rows: WeeklyRow[]; warnings: string[] } {
  const before = new Map(baseline.map((r) => [normalizeUsername(r.username), r.lifetimeSol]));
  const warnings: string[] = [];
  const rows: WeeklyRow[] = [];
  const latestKeys = new Set<string>();
  for (const r of latest) {
    const key = normalizeUsername(r.username);
    latestKeys.add(key);
    const diff = solToLamports(r.lifetimeSol) - solToLamports(before.get(key) ?? 0);
    if (diff < 0) {
      warnings.push(`${r.username}'s total went down (${before.get(key)} → ${r.lifetimeSol} SOL); counted as 0.`);
      continue;
    }
    if (diff > 0) rows.push({ username: r.username, wageredSol: lamportsToSol(diff), lifetimeSol: r.lifetimeSol });
  }
  const missing = baseline.filter((r) => !latestKeys.has(normalizeUsername(r.username)));
  if (missing.length) {
    warnings.push(
      `${missing.length} player${missing.length === 1 ? " is" : "s are"} in the earlier copy but missing from the latest one ` +
        `(e.g. ${missing.slice(0, 3).map((r) => r.username).join(", ")}). Did the copy include every page of the list?`,
    );
  }
  rows.sort((a, b) => b.wageredSol - a.wageredSol);
  return { rows, warnings };
}
