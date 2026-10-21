import { describe, expect, it } from "vitest";
import { applyAdminCredentials, isUsableSecret, readEnvValue, setEnvValue } from "../env-file";
import { pickClientIp } from "../login-limiter";

const SECRET = "s".repeat(43);

describe("applyAdminCredentials (npm run admin:password)", () => {
  it("replaces the blank SESSION_SECRET that .env.example ships with", () => {
    const env = 'DATABASE_URL="file:./dev.db"\nADMIN_PASSWORD_HASH=""\nSESSION_SECRET=""\n';
    const out = applyAdminCredentials(env, "scrypt:a:b", SECRET);
    expect(readEnvValue(out, "SESSION_SECRET")).toBe(SECRET);
    expect(readEnvValue(out, "ADMIN_PASSWORD_HASH")).toBe("scrypt:a:b");
    expect(readEnvValue(out, "DATABASE_URL")).toBe("file:./dev.db");
  });

  it("replaces a too-short secret", () => {
    const out = applyAdminCredentials('SESSION_SECRET="short"\n', "h", SECRET);
    expect(readEnvValue(out, "SESSION_SECRET")).toBe(SECRET);
  });

  it("adds a secret when the key is missing", () => {
    const out = applyAdminCredentials("", "h", SECRET);
    expect(readEnvValue(out, "SESSION_SECRET")).toBe(SECRET);
  });

  it("keeps a valid existing secret so sessions survive a password change", () => {
    const existing = "e".repeat(40);
    const out = applyAdminCredentials(`SESSION_SECRET="${existing}"\n`, "h", SECRET);
    expect(readEnvValue(out, "SESSION_SECRET")).toBe(existing);
  });

  it("treats $ in values literally", () => {
    expect(readEnvValue(setEnvValue("", "K", "a$1b"), "K")).toBe("a$1b");
    expect(readEnvValue(setEnvValue('K="x"\n', "K", "a$&b"), "K")).toBe("a$&b");
  });

  it("isUsableSecret requires 32+ characters", () => {
    expect(isUsableSecret(undefined)).toBe(false);
    expect(isUsableSecret("")).toBe(false);
    expect(isUsableSecret("x".repeat(31))).toBe(false);
    expect(isUsableSecret("x".repeat(32))).toBe(true);
  });
});

describe("pickClientIp", () => {
  const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });
  const spoofed = headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1", "x-real-ip": "7.7.7.7" });

  it("ignores forwarding headers unless a proxy is trusted", () => {
    expect(pickClientIp(spoofed, {})).toBe("direct");
  });

  it("uses the first X-Forwarded-For hop behind a trusted proxy", () => {
    expect(pickClientIp(spoofed, { TRUST_PROXY_HEADERS: "true" })).toBe("6.6.6.6");
    expect(pickClientIp(headers({ "x-real-ip": "7.7.7.7" }), { TRUST_PROXY_HEADERS: "true" })).toBe("7.7.7.7");
  });

  it("prefers Vercel's own header on Vercel", () => {
    const h = headers({ "x-vercel-forwarded-for": "1.2.3.4", "x-forwarded-for": "6.6.6.6" });
    expect(pickClientIp(h, { VERCEL: "1" })).toBe("1.2.3.4");
  });

  it("falls back to the shared bucket when trusted headers are missing", () => {
    expect(pickClientIp(headers({}), { TRUST_PROXY_HEADERS: "true" })).toBe("direct");
    expect(pickClientIp(headers({}), { VERCEL: "1" })).toBe("direct");
  });
});
