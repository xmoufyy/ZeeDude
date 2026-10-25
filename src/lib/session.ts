import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless signed session token: "<base64url payload>.<base64url HMAC>".
// Kept free of Next.js imports so it can be unit tested.

/** `sub` identifies who the session is for (player sessions carry the wallet). */
export type SessionPayload = { iat: number; exp: number; sub?: string };

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export function createSessionToken(key: string, now: number, ttlMs: number, sub?: string): string {
  const body = b64url(JSON.stringify({ iat: now, exp: now + ttlMs, ...(sub ? { sub } : {}) } satisfies SessionPayload));
  return `${body}.${sign(body, key)}`;
}

/**
 * One cookie's value from a raw Cookie header. A value that isn't valid
 * percent-encoding (e.g. a hand-edited `name=%`) reads as missing instead of
 * throwing, so a bad cookie just means "signed out".
 */
export function readCookie(header: string, name: string): string | undefined {
  const raw = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

export function readSessionToken(token: string | undefined, key: string, now: number): SessionPayload | null {
  if (!token) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(body, key));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
