// Small helpers for editing a .env file's text without touching other lines.

const MIN_SECRET_LENGTH = 32;

function lineFor(key: string) {
  return new RegExp(`^${key}=(.*)$`, "m");
}

/** The value of `key` in .env text (quotes stripped), or undefined if absent. */
export function readEnvValue(env: string, key: string): string | undefined {
  const match = lineFor(key).exec(env);
  if (!match) return undefined;
  return match[1].trim().replace(/^(["'])(.*)\1$/, "$2");
}

/** Sets `key` to `value`, replacing an existing line or appending a new one. */
export function setEnvValue(env: string, key: string, value: string): string {
  const line = `${key}="${value}"`;
  const pattern = lineFor(key);
  return pattern.test(env) ? env.replace(pattern, () => line) : `${env.trimEnd()}\n${line}\n`;
}

/** A session secret is usable when it's at least 32 characters (see src/lib/auth.ts). */
export function isUsableSecret(value: string | undefined): boolean {
  return (value?.trim().length ?? 0) >= MIN_SECRET_LENGTH;
}

/**
 * Writes the admin password hash, and a session secret only if the current
 * one is missing, empty, or too short (e.g. the blank SESSION_SECRET="" that
 * .env.example ships with). A valid existing secret is kept so sessions survive.
 */
export function applyAdminCredentials(env: string, passwordHash: string, newSecret: string): string {
  let next = setEnvValue(env, "ADMIN_PASSWORD_HASH", passwordHash);
  if (!isUsableSecret(readEnvValue(next, "SESSION_SECRET"))) next = setEnvValue(next, "SESSION_SECRET", newSecret);
  return next;
}
