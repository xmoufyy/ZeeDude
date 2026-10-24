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

// "Wagered" as a standalone word (not part of a username like "wageredking").
const WAGERED = /(?<![\p{L}\p{N}_])wagered(?![\p{L}\p{N}_])/giu;
// The amount right after a "Wagered" label (an optional ":" or SOL symbol
// first). It must be a whole number token: "1e10" or "5.5.5" don't match.
const AMOUNT_AFTER = /^[\s:]*[◎$]?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)(?![\p{L}\p{N}_]|[.,]\d)/u;
// Where the previous card's text ends: its dates and times and its other
// labels. Labels only count as whole words, so "RegeneratedKing" stays intact.
const CARD_END =
  /\d{1,2}\/\d{1,2}\/\d{2,4}(?:,?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AP]M)?)?|(?<![\p{L}\p{N}_])(?:comm?iss?ion|generated|first\s+seen|last\s+seen)(?![\p{L}\p{N}_])/giu;
// Amounts left over from the previous card on the same line (its commission).
const LEADING_AMOUNTS = /^(?:[◎$]?\d[\d,]*(?:\.\d+)?(?:\s*sol)?(?![\p{L}\p{N}_])\s*)+/iu;
// The first line of a simple list's header: a name column, then a delimiter.
const LIST_HEADER = /^\s*(?:user\s*name|username|user|name|player|referral|account)s?\s*[,;\t]/i;
// Labels that only player cards have (page-level totals above the list don't).
const CARD_MARKER = /(?<![\p{L}\p{N}_])(?:generated|first\s+seen|last\s+seen)(?![\p{L}\p{N}_])/iu;
// Verified ticks and similar marks the page shows after a name.
const TRAILING_MARKS = /[\s✓✔☑✅︎️]+$/u;
const EXTRA_COLUMN = /(?:[,;\t]|\s{2,})\s*[◎$]?\s*[\d,]*\.?\d+\s*(?:sol)?$/i;

function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(TRAILING_MARKS, "").trim();
}

const lineAt = (text: string, index: number) => text.slice(0, index).split("\n").length;

/**
 * The player name just before a "Wagered" label: the last line after the
 * previous card's last date or label. Only on the line that card ended on
 * (a flattened copy) are leading amounts stripped; a name on its own line is
 * kept whole ("Agent 47 Smith"), unless it's just a decimal amount.
 */
function nameBefore(prefix: string): string {
  let cut = 0;
  for (const m of prefix.matchAll(CARD_END)) cut = m.index + m[0].length;
  const lines = prefix.slice(cut).split("\n").map(cleanName);
  const index = lines.findLastIndex(Boolean);
  if (index < 0) return "";
  if (index === 0) return cleanName(lines[0].replace(LEADING_AMOUNTS, "")) || (/^\d+$/.test(lines[0]) ? lines[0] : "");
  return /^[◎$]?[\d,]*\.\d+(\s*sol)?$/i.test(lines[index]) ? "" : lines[index];
}

type Found = { line: number; name: string; amount: string };

/**
 * Reads text copied from SolPump's affiliate page, in whatever layout the copy
 * produced: labels and values on separate lines, on one line, tab-separated or
 * flattened. Each player card is a name followed by "Wagered <amount>";
 * commission, dates, avatars and ticks are ignored, and so are page totals
 * above the first card.
 * Falls back to strict "name, amount" lines when there are no "Wagered" labels.
 */
export function parseAffiliatePaste(raw: string): AffiliateParse {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/[  -​ ]/g, " ");
  const errors: string[] = [];
  const warnings: string[] = [];
  // A CSV-style header ("username, wagered") isn't a player card. It must start
  // with a name column, so a card line like "Alice<TAB>Wagered" still counts.
  const firstLine = text.trimStart().split("\n")[0];
  const headerEnd = LIST_HEADER.test(firstLine) && !/\d/.test(firstLine) ? text.indexOf(firstLine) + firstLine.length : 0;
  const labels = [...text.matchAll(WAGERED)].filter((m) => m.index >= headerEnd);
  let found: Found[];

  if (labels.length) {
    const cards: (Found & { card: boolean })[] = [];
    let cursor = 0;
    labels.forEach((m, k) => {
      const end = m.index + m[0].length;
      const nextStart = labels[k + 1]?.index ?? text.length;
      const amount = AMOUNT_AFTER.exec(text.slice(end, nextStart));
      const afterAmount = amount ? end + amount[0].length : end;
      cards.push({
        line: lineAt(text, m.index),
        name: nameBefore(text.slice(cursor, m.index)),
        amount: amount?.[1] ?? "",
        card: CARD_MARKER.test(text.slice(afterAmount, nextStart)),
      });
      cursor = afterAmount;
    });
    // Page totals ("Total Wagered ...") sit above the list; anything after the
    // first card counts, even a last card cut off before its commission.
    const firstCard = cards.findIndex((c) => c.card);
    // Only recognized page totals may be skipped. Missing metadata on a
    // player's card must never cause that player to disappear from an import.
    const header = [];
    for (let i = 0; i < firstCard; i++) {
      if (!/^(?:total|total\s+wagers?|all[- ]time)$/i.test(cards[i].name)) break;
      header.push(cards[i]);
    }
    for (const c of header) warnings.push(`Line ${c.line}: skipped "${c.name ? `${c.name} ` : ""}Wagered" text above the player list.`);
    found = cards.slice(header.length);
    for (const c of found) if (!c.name) errors.push(`Line ${c.line}: found "Wagered" with no player name before it.`);
    found = found.filter((c) => c.name);
  } else {
    // Simple list: every non-empty line must be "name, amount" (a first line
    // with recognized column names is treated as a header).
    found = [];
    const lines = text.split("\n").map((l) => l.trim());
    let seenContent = false;
    lines.forEach((line, i) => {
      if (!line) return;
      const plain = /^(.+?)(?:\s*[,;\t]\s*|\s{2,})([◎$]?\s*[\d,]*\.?\d+)\s*(sol)?$/i.exec(line);
      if (plain && EXTRA_COLUMN.test(plain[1])) {
        errors.push(`Line ${i + 1}: more than one number in "${line.slice(0, 40)}". Paste just the name and the wagered amount.`);
      } else if (plain) found.push({ line: i + 1, name: plain[1], amount: plain[2] });
      else if (!seenContent && /^\s*(?:user\s*name|user|name|player|referral|account)s?\s*[,;\t]\s*(?:wagered|amount|total|lifetime)(?:\s*\(?sol\)?)?\s*$/i.test(line)) {
        // header
      } else errors.push(`Line ${i + 1}: expected "name, amount" but got "${line.slice(0, 40)}".`);
      seenContent = true;
    });
  }

  const byKey = new Map<string, AffiliateRow>();
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

/** `createdAt` orders copies that share a `takenAt` (the later save wins). */
export type SnapshotRef = { id: string; takenAt: Date; createdAt?: Date };
export type PeriodWindow = { startsAt: Date; endsAt: Date };

/**
 * Which snapshots to compare for a period: the latest one taken more than the
 * grace window after the start and before the period ended (plus grace),
 * against the one taken closest to its start among copies strictly older than
 * that latest one. Returns nulls when there's nothing to compare yet.
 */
export function pickSnapshots<T extends SnapshotRef>(
  snapshots: T[],
  period: PeriodWindow,
): { latest: T | null; baseline: T | null; baselineOffMs: number | null } {
  const endLimit = period.endsAt.getTime() + BOUNDARY_GRACE_MS;
  const start = period.startsAt.getTime();
  const sorted = [...snapshots].sort(
    (a, b) => a.takenAt.getTime() - b.takenAt.getTime() || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );
  // Copies sharing a time are re-saves of one moment: only the last saved one
  // (a correction) counts, whether it ends up as the latest or the baseline.
  const usable = sorted.filter(
    (s, i) => s.takenAt.getTime() <= endLimit && sorted[i + 1]?.takenAt.getTime() !== s.takenAt.getTime(),
  );
  const latest = usable.at(-1) ?? null;
  // A copy taken within the grace window around the start is this period's
  // starting point, never its latest: comparing it with an older copy would
  // count the previous period's last bets. No totals until a later copy.
  if (!latest || latest.takenAt.getTime() <= start + BOUNDARY_GRACE_MS) return { latest: null, baseline: null, baselineOffMs: null };

  // A copy with the same time as the latest one is the same moment, so it
  // can't serve as the starting point (it would zero every total).
  let baseline: T | null = null;
  for (const s of usable) {
    if (s.takenAt.getTime() >= latest.takenAt.getTime()) break;
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
