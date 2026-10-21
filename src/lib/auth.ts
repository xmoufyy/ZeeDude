import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "./db";
import { verifyPassword } from "./password";
import { createSessionToken, readSessionToken } from "./session";

const COOKIE_NAME = "zd_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 5;
// Caps guessing from many IPs at once (e.g. a botnet), at the cost of
// briefly locking out the real admin during an attack.
const MAX_FAILURES_GLOBAL = 30;

function config() {
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const secret = process.env.SESSION_SECRET?.trim();
  if (!passwordHash || !secret || secret.length < 32) {
    throw new Error(
      "Admin login is not configured. Set ADMIN_PASSWORD_HASH and SESSION_SECRET (32+ chars). See README.",
    );
  }
  // Mixing the password hash into the signing key means changing the
  // password instantly signs out every existing session.
  return { passwordHash, signingKey: `${secret}|${passwordHash}` };
}

export function isAuthConfigured(): boolean {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  // Admin checks are always per request, never part of a prerendered shell.
  await connection();
  if (!isAuthConfigured()) return false;
  // Read from the raw Cookie header rather than cookies(): in `next dev`,
  // cookies() throws an InvariantError when a page re-renders inside a
  // Server Action request (Next 16.4). The token is signature-checked either way.
  const header = (await headers()).get("cookie") ?? "";
  const token = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  return readSessionToken(token && decodeURIComponent(token), config().signingKey, Date.now()) !== null;
}

/** Call at the top of every admin page and Server Action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(password: string): Promise<LoginResult> {
  const { passwordHash, signingKey } = config();
  const ip = await clientIp();
  const since = new Date(Date.now() - FAILURE_WINDOW_MS);

  const [ipFailures, allFailures] = await Promise.all([
    db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { success: false, createdAt: { gte: since } } }),
  ]);
  if (ipFailures >= MAX_FAILURES_PER_IP || allFailures >= MAX_FAILURES_GLOBAL) {
    return { ok: false, error: "Too many failed attempts. Try again in 15 minutes." };
  }

  const valid = await verifyPassword(password, passwordHash);
  await db.loginAttempt.create({ data: { ip, success: valid } });
  // Old attempts are only needed for the rate-limit window.
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });

  if (!valid) return { ok: false, error: "Wrong password." };

  (await cookies()).set(COOKIE_NAME, createSessionToken(signingKey, Date.now(), SESSION_TTL_MS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
