import "server-only";
import type { Period } from "@prisma/client";
import { db } from "./db";
import { normalizeUsername } from "./ranking";
import { publishedStandings } from "./standings";
import type { AdminStandingRow } from "./standings-export";

// Real-name standings for the admin panel. Callers check the admin session first.

export type AdminPeriodStatus = "scheduled" | "live" | "needs-ending" | "ended";

export function periodStatus(period: Pick<Period, "startsAt" | "endsAt" | "finalizedAt">, now = new Date()): AdminPeriodStatus {
  if (period.finalizedAt) return "ended";
  if (period.endsAt <= now) return "needs-ending";
  if (period.startsAt > now) return "scheduled";
  return "live";
}

/**
 * The standings exactly as the public board ranks them (locked results once a
 * period has ended), with real usernames, paid status and profile links.
 */
export async function adminStandings(period: Period): Promise<AdminStandingRow[]> {
  const [rows, payouts, players] = await Promise.all([
    publishedStandings(period),
    period.finalizedAt ? db.payout.findMany({ where: { periodId: period.id }, select: { username: true, paid: true } }) : [],
    db.player.findMany({
      where: { solpumpStatus: { in: ["approved", "pending"] }, solpumpKey: { not: null } },
      select: { solpumpKey: true, solpumpStatus: true, wallet: true },
    }),
  ]);
  const paidBy = new Map(payouts.map((p) => [p.username, p.paid]));
  const claimBy = new Map(players.map((p) => [p.solpumpKey!, p]));
  return rows.map((r) => {
    const claim = claimBy.get(normalizeUsername(r.username));
    return {
      rank: r.rank,
      username: r.username,
      wageredSol: r.wageredSol,
      prizeSol: r.prizeSol,
      paid: period.finalizedAt && r.prizeSol > 0 ? (paidBy.get(r.username) ?? false) : undefined,
      wallet: claim?.solpumpStatus === "approved" ? claim.wallet : undefined,
      claimPending: claim?.solpumpStatus === "pending" || undefined,
    };
  });
}
