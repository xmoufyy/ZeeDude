import "server-only";
import { Prisma } from "@prisma/client";
import { gapsToNextPlace } from "./board-stats";
import { db } from "./db";
import { normalizeUsername } from "./ranking";
import { computeStandings } from "./standings";
import { serializable } from "./tx";
import type { ProfileInput } from "./profile-schema";

export { profileSchema, type ProfileInput } from "./profile-schema";

export class ProfileError extends Error {}

export type ClaimStatus = "none" | "pending" | "approved" | "rejected";

/**
 * Saves a player's profile. Changing the SolPump username sends the claim
 * back to "pending" for an admin to approve; two players can't hold a claim
 * on the same name at once.
 */
export async function saveProfile(wallet: string, input: ProfileInput): Promise<{ claimChanged: boolean; status: ClaimStatus }> {
  try {
    return await serializable(async (tx) => {
      const player = await tx.player.findUnique({ where: { wallet } });
      if (!player) throw new ProfileError("Your session expired. Please sign in again.");

      const newKey = input.solpumpUsername ? normalizeUsername(input.solpumpUsername) : null;
      const claimChanged = newKey !== player.solpumpKey;
      let status = player.solpumpStatus as ClaimStatus;
      if (claimChanged) {
        if (newKey) {
          const holder = await tx.player.findUnique({ where: { solpumpKey: newKey } });
          if (holder && holder.id !== player.id) {
            throw new ProfileError("That SolPump username is already claimed. If it's yours, message us on Discord.");
          }
          status = "pending";
        } else {
          status = "none";
        }
      }

      await tx.player.update({
        where: { wallet },
        data: {
          displayName: input.displayName ?? null,
          discordUsername: input.discordUsername ?? null,
          kickUsername: input.kickUsername ?? null,
          xUsername: input.xUsername ?? null,
          hideName: input.hideName,
          ...(claimChanged
            ? { solpumpUsername: input.solpumpUsername ?? null, solpumpKey: newKey, solpumpStatus: status }
            : // Same name, maybe different capitalisation: keep the status.
              { solpumpUsername: input.solpumpUsername ?? null }),
        },
      });
      return { claimChanged, status };
    });
  } catch (error) {
    // Two players claiming the same name at the same moment: the unique index decides.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ProfileError("That SolPump username is already claimed. If it's yours, message us on Discord.");
    }
    throw error;
  }
}

/** Approved claims: lowercased SolPump username -> whether that player hides their name. */
export async function approvedNamePreferences(): Promise<Map<string, boolean>> {
  const players = await db.player.findMany({
    where: { solpumpStatus: "approved", solpumpKey: { not: null } },
    select: { solpumpKey: true, hideName: true },
  });
  return new Map(players.map((p) => [p.solpumpKey!, p.hideName]));
}

export type PlayerStats = {
  rank: number | null;
  wageredSol: number | null;
  prizeSol: number | null;
  /** SOL needed to pass the next better rank this week (`gapRank`), if not leading. */
  gapSol: number | null;
  gapRank: number | null;
  wonSol: number;
  pendingSol: number;
};

/** Leaderboard numbers for an approved SolPump username. */
export async function playerStats(solpumpKey: string): Promise<PlayerStats> {
  const now = new Date();
  const live = await db.period.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gt: now }, finalizedAt: null },
    orderBy: { startsAt: "desc" },
  });
  const standings = live ? await computeStandings(live) : [];
  const row = standings.find((r) => normalizeUsername(r.username) === solpumpKey);
  const gap = row ? gapsToNextPlace(standings).get(solpumpKey) : undefined;

  // Payout rows store the name as imported; compare case-insensitively.
  const payouts = (await db.payout.findMany({ select: { username: true, amountSol: true, paid: true } })).filter(
    (p) => normalizeUsername(p.username) === solpumpKey,
  );
  return {
    rank: row?.rank ?? null,
    wageredSol: row?.wageredSol ?? null,
    prizeSol: row && row.prizeSol > 0 ? row.prizeSol : null,
    gapSol: gap?.sol ?? null,
    gapRank: gap?.rank ?? null,
    wonSol: payouts.filter((p) => p.paid).reduce((sum, p) => sum + p.amountSol, 0),
    pendingSol: payouts.filter((p) => !p.paid).reduce((sum, p) => sum + p.amountSol, 0),
  };
}

const REVIEWABLE_FROM: Record<"approve" | "reject" | "reset", ClaimStatus> = {
  approve: "pending",
  reject: "pending",
  reset: "approved",
};

/**
 * Admin: approve, reject or unverify a SolPump username claim.
 * `reviewedKey` is the (lowercased) name the admin was looking at. If the
 * player changed their claim since the page loaded, the decision is refused
 * instead of being applied to a name the admin never reviewed.
 */
export async function reviewClaim(playerId: string, decision: "approve" | "reject" | "reset", reviewedKey: string) {
  return serializable(async (tx) => {
    const player = await tx.player.findUnique({ where: { id: playerId } });
    if (!player) throw new ProfileError("Player not found.");
    if (!player.solpumpKey || player.solpumpKey !== reviewedKey) {
      throw new ProfileError("This player changed their SolPump username since you loaded the page. Review it again.");
    }
    if (player.solpumpStatus !== REVIEWABLE_FROM[decision]) {
      throw new ProfileError(`This claim is now "${player.solpumpStatus}", so it can't be changed that way. Refresh and review again.`);
    }
    if (decision === "approve") {
      return tx.player.update({ where: { id: playerId }, data: { solpumpStatus: "approved" } });
    }
    if (decision === "reject") {
      // Free the name so its real owner can claim it.
      return tx.player.update({ where: { id: playerId }, data: { solpumpStatus: "rejected", solpumpKey: null } });
    }
    return tx.player.update({ where: { id: playerId }, data: { solpumpStatus: "pending" } });
  });
}
