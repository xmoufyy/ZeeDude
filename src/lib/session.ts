import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless signed session token: "<base64url payload>.<base64url HMAC>".
// Kept free of Next.js imports so it can be unit tested.

export type SessionPayload = { iat: number; exp: number };

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export function createSessionToken(key: string, now: number, ttlMs: number): string {
  const body = b64url(JSON.stringify({ iat: now, exp: now + ttlMs } satisfies SessionPayload));
  return `${body}.${sign(body, key)}`;
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
