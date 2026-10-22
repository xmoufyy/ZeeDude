import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { db } from "./db";
import { createSessionToken, readSessionToken } from "./session";
import { buildSignInMessage, isSolanaAddress, verifyWalletSignature } from "./solana-auth";

// Player sessions: sign in with a Solana wallet, separate from the admin login.

const COOKIE_NAME = "zd_player";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NONCE_TTL_MS = 5 * 60 * 1000;
// Unused challenges are cheap but not free; refuse new ones past this many.
const MAX_OPEN_NONCES = 1000;

export class PlayerAuthError extends Error {}

function signingKey(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new PlayerAuthError("Profiles aren't set up on this site yet (SESSION_SECRET is missing).");
  }
  // A different key from admin sessions, so neither token works as the other.
  return `${secret}|player-session`;
}

/** The signed-in player's wallet, or null. Per request; reads the raw Cookie header (see auth.ts). */
export async function currentPlayerWallet(): Promise<string | null> {
  await connection();
  let key: string;
  try {
    key = signingKey();
  } catch {
    return null;
  }
  const header = (await headers()).get("cookie") ?? "";
  const token = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  const payload = readSessionToken(token && decodeURIComponent(token), key, Date.now());
  return payload?.sub && isSolanaAddress(payload.sub) ? payload.sub : null;
}

/** Step 1: issue a one-time message for the wallet to sign. */
export async function startWalletSignIn(wallet: string): Promise<{ nonce: string; message: string }> {
  if (!isSolanaAddress(wallet)) throw new PlayerAuthError("That doesn't look like a Solana wallet address.");
  signingKey(); // fail early if sessions can't be issued
  const now = new Date();

  await db.walletNonce.deleteMany({ where: { expiresAt: { lt: now } } });
  if ((await db.walletNonce.count()) >= MAX_OPEN_NONCES) {
    throw new PlayerAuthError("Too many sign-in attempts right now. Please try again in a few minutes.");
  }
  // Only the newest challenge per wallet stays valid.
  await db.walletNonce.deleteMany({ where: { wallet } });

  const host = (await headers()).get("host") ?? new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost").host;
  const nonce = randomBytes(16).toString("hex");
  const message = buildSignInMessage({ domain: host, wallet, nonce, issuedAt: now });
  await db.walletNonce.create({ data: { nonce, wallet, message, expiresAt: new Date(now.getTime() + NONCE_TTL_MS) } });
  return { nonce, message };
}

/**
 * Step 2: check the signature against the message *we* stored for that
 * nonce, burn the nonce (single use), and start a session.
 */
export async function finishWalletSignIn(wallet: string, nonce: string, signatureBase64: string): Promise<void> {
  const row = await db.walletNonce.findUnique({ where: { nonce } });
  if (!row || row.wallet !== wallet || row.expiresAt < new Date()) {
    throw new PlayerAuthError("That sign-in request expired. Please try again.");
  }
  // Delete first: if two requests race with the same nonce, only one deletes it.
  const burned = await db.walletNonce.deleteMany({ where: { nonce, wallet } });
  if (burned.count !== 1) throw new PlayerAuthError("That sign-in request was already used. Please try again.");

  const signature = Buffer.from(signatureBase64, "base64");
  if (!verifyWalletSignature(wallet, row.message, signature)) {
    throw new PlayerAuthError("The wallet signature didn't match. Please try again.");
  }

  await db.player.upsert({ where: { wallet }, create: { wallet }, update: {} });
  (await cookies()).set(COOKIE_NAME, createSessionToken(signingKey(), Date.now(), SESSION_TTL_MS, wallet), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function signOutPlayer(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
