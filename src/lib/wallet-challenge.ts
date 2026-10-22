import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { buildSignInMessage } from "./solana-auth";
import { BusyError, serializable } from "./tx";

// Creating wallet sign-in challenges. Kept free of Next.js request APIs so
// scripts/verify-concurrency.ts can race it directly against SQLite and Postgres.

export const NONCE_TTL_MS = 5 * 60 * 1000;
// Unused challenges are cheap but not free; refuse new ones past this many.
export const MAX_OPEN_NONCES = 1000;

export class ChallengeError extends Error {}

/**
 * Prune, cap check, replace and create in one serializable transaction, so
 * concurrent starts can't exceed the cap. WalletNonce.wallet is unique, so
 * only the newest challenge per wallet can ever exist.
 */
export async function createWalletChallenge(wallet: string, host: string, now = new Date()): Promise<{ nonce: string; message: string }> {
  const nonce = randomBytes(16).toString("hex");
  const message = buildSignInMessage({ domain: host, wallet, nonce, issuedAt: now });
  try {
    await serializable(async (tx) => {
      await tx.walletNonce.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { wallet }] } });
      if ((await tx.walletNonce.count()) >= MAX_OPEN_NONCES) {
        throw new ChallengeError("Too many sign-in attempts right now. Please try again in a few minutes.");
      }
      await tx.walletNonce.create({ data: { nonce, wallet, message, expiresAt: new Date(now.getTime() + NONCE_TTL_MS) } });
    });
  } catch (error) {
    // Two starts for the same wallet at the same instant: the unique index or
    // the retry budget decides, and the loser just tries again.
    if ((error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || error instanceof BusyError) {
      throw new ChallengeError("Another sign-in for this wallet is in progress. Please try again.");
    }
    throw error;
  }
  return { nonce, message };
}
