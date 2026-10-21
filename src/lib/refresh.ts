import "server-only";
import { revalidateTag } from "next/cache";
import { findOverlappingPeriod, snapshotPeriod } from "./admin-ops";
import { db } from "./db";
import { saveEntries } from "./entries";
import { LEADERBOARD_TAG } from "./leaderboard";
import { weeklyWindow } from "./period";
import { getConfiguredProvider, ProviderError, type ProviderKind } from "./providers";

export type ProviderStatus = {
  provider: ProviderKind;
  pull: boolean;
  lastRunAt: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
};

export type RefreshReport = {
  ok: boolean;
  provider: ProviderKind;
  createdPeriod: string | null;
  refreshed: { period: string; players: number }[];
  errors: string[];
};

const STATUS_KEY = "providerStatus";

export async function getProviderStatus(): Promise<ProviderStatus | null> {
  const row = await db.setting.findUnique({ where: { key: STATUS_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as ProviderStatus;
  } catch {
    return null;
  }
}

async function saveProviderStatus(status: ProviderStatus) {
  const value = JSON.stringify(status);
  await db.setting.upsert({ where: { key: STATUS_KEY }, create: { key: STATUS_KEY, value }, update: { value } });
}

/**
 * Makes sure the current week has a period, copying the most recent period's
 * prize setup. Does nothing if any period already covers part of this week
 * (so custom or biweekly schedules are left alone) or if no period has ever
 * been set up. Disable with AUTO_CREATE_PERIODS=false.
 */
export async function ensureCurrentPeriod(now = new Date()): Promise<string | null> {
  if (process.env.AUTO_CREATE_PERIODS?.trim().toLowerCase() === "false") return null;
  const { start, end } = weeklyWindow(now);
  if (await findOverlappingPeriod(start, end)) return null;
  const template = await db.period.findFirst({ orderBy: { startsAt: "desc" } });
  if (!template) return null;

  const name = `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`;
  await db.period.create({
    data: { name, startsAt: start, endsAt: end, prizePoolSol: template.prizePoolSol, payoutSplit: template.payoutSplit },
  });
  return name;
}

/**
 * One refresh cycle, run by the cron route and the admin "Refresh now" button:
 *  1. Create this week's period if it's missing.
 *  2. If the data source is pulled (the SolPump API), fetch fresh totals for
 *     every open period. On failure, existing data is kept untouched.
 *  3. Snapshot open periods and expire the public cache.
 */
export async function runRefresh(): Promise<RefreshReport> {
  const provider = getConfiguredProvider();
  const report: RefreshReport = { ok: true, provider: provider.kind, createdPeriod: null, refreshed: [], errors: [] };
  const previous = await getProviderStatus();
  const now = new Date();

  report.createdPeriod = await ensureCurrentPeriod(now);

  // Open = started and not yet ended by an admin. Periods past their end
  // date stay open so the final totals can still come in before they're ended.
  const open = await db.period.findMany({ where: { finalizedAt: null, startsAt: { lte: now } } });

  for (const period of open) {
    if (provider.pull) {
      try {
        const entries = await provider.fetchEntries(period);
        await saveEntries(period.id, entries, "replace", provider.kind);
        report.refreshed.push({ period: period.name, players: entries.length });
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        report.ok = false;
        report.errors.push(`${period.name}: ${error.message}`);
        continue;
      }
    }
    await snapshotPeriod(period.id);
  }

  const stamp = new Date().toISOString();
  await saveProviderStatus({
    provider: provider.kind,
    pull: provider.pull,
    lastRunAt: stamp,
    lastSuccessAt: report.ok ? stamp : (previous?.lastSuccessAt ?? null),
    lastErrorAt: report.ok ? (previous?.lastErrorAt ?? null) : stamp,
    lastError: report.ok ? (previous?.lastError ?? null) : report.errors.join("\n"),
  });

  revalidateTag(LEADERBOARD_TAG, { expire: 0 });
  return report;
}
