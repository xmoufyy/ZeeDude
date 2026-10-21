import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Stored format: "scrypt:<salt base64>:<key base64>". No "$" characters, so
// the value is safe in .env files (Next.js expands $VARS in env values).
const KEY_LENGTH = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await derive(password, Buffer.from(saltB64, "base64"));
  return timingSafeEqual(actual, expected);
}
