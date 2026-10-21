import type { PrismaClient } from "@prisma/client";

// Login rate limiting. Kept free of Next.js imports so the concurrency
// verifier can drive it directly against SQLite and Postgres.

export const FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_IP = 5;
// Caps guessing from many IPs at once (e.g. a botnet), at the cost of
// briefly locking out the real admin during an attack.
export const MAX_FAILURES_GLOBAL = 30;

type HeaderReader = { get(name: string): string | null };

/**
 * Which header to trust for the client IP. Forwarding headers are only
 * trusted behind a proxy that sets them; otherwise anyone could rotate a
 * fake X-Forwarded-For to dodge the per-IP limit. Untrusted requests share
 * the "direct" bucket, so both limits still apply.
 */
export function pickClientIp(headers: HeaderReader, env: Record<string, string | undefined> = process.env): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim().slice(0, 64) || null;
  if (env.VERCEL === "1") {
    return first(headers.get("x-vercel-forwarded-for")) ?? first(headers.get("x-forwarded-for")) ?? "direct";
  }
  if (env.TRUST_PROXY_HEADERS?.trim().toLowerCase() === "true") {
    return first(headers.get("x-forwarded-for")) ?? first(headers.get("x-real-ip")) ?? "direct";
  }
  return "direct";
}

export type Reservation = { allowed: true; attemptId: string } | { allowed: false };

async function countFailures(db: PrismaClient, ip: string, since: Date) {
  const ipFailures = await db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } });
  const allFailures = await db.loginAttempt.count({ where: { success: false, createdAt: { gte: since } } });
  return { ipFailures, allFailures };
}

/**
 * Reserve-then-count: record this attempt as a failure *first*, then count
 * failures in the window including it. Every concurrent request's row is
 * committed before its own count, so parallel requests see each other and
 * can't all slip under the limit. The worst case is over-rejecting.
 *
 * A client that is already locked out is rejected *before* anything is
 * written, so a sustained attack can't grow the table without bound. The lock
 * then lasts until its recorded failures age out of the window.
 */
export async function reserveLoginAttempt(db: PrismaClient, ip: string, now = new Date()): Promise<Reservation> {
  const since = new Date(now.getTime() - FAILURE_WINDOW_MS);
  const before = await countFailures(db, ip, since);
  if (before.ipFailures >= MAX_FAILURES_PER_IP || before.allFailures >= MAX_FAILURES_GLOBAL) return { allowed: false };

  const attempt = await db.loginAttempt.create({ data: { ip, success: false, createdAt: now } });
  const after = await countFailures(db, ip, since);
  if (after.ipFailures > MAX_FAILURES_PER_IP || after.allFailures > MAX_FAILURES_GLOBAL) return { allowed: false };
  return { allowed: true, attemptId: attempt.id };
}

/** A correct password clears the reservation so it doesn't count as a failure. */
export async function markLoginSucceeded(db: PrismaClient, attemptId: string) {
  await db.loginAttempt.update({ where: { id: attemptId }, data: { success: true } });
}

/** Attempts are only needed for the rate-limit window. */
export async function pruneLoginAttempts(db: PrismaClient, now = new Date()) {
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
}
