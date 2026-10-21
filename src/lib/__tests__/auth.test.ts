import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";
import { createSessionToken, readSessionToken } from "../session";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt:[^$]+:[^$]+$/);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batter", hash)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt:abc:def")).toBe(false);
    expect(await verifyPassword("x", "scrypt:abc:short")).toBe(false);
  });
});

describe("session tokens", () => {
  const key = "k".repeat(40);
  const now = 1_800_000_000_000;

  it("round-trips a valid token", () => {
    const token = createSessionToken(key, now, 60_000);
    expect(readSessionToken(token, key, now + 1000)).toMatchObject({ iat: now, exp: now + 60_000 });
  });

  it("rejects expired tokens", () => {
    const token = createSessionToken(key, now, 60_000);
    expect(readSessionToken(token, key, now + 60_000)).toBeNull();
  });

  it("rejects tokens signed with another key (e.g. after a password change)", () => {
    const token = createSessionToken(key, now, 60_000);
    expect(readSessionToken(token, `${key}x`, now)).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const token = createSessionToken(key, now, 60_000);
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ iat: now, exp: now + 1e12 })).toString("base64url");
    expect(readSessionToken(`${forged}.${sig}`, key, now)).toBeNull();
    expect(readSessionToken(`${token}.extra`, key, now)).toBeNull();
    expect(readSessionToken(undefined, key, now)).toBeNull();
    expect(readSessionToken("garbage", key, now)).toBeNull();
  });
});
