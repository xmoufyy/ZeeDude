// Sets the admin password for local dev by writing ADMIN_PASSWORD_HASH (and a
// SESSION_SECRET if missing, empty or too short) into .env. For production, run with --print and
// paste the values into your host's environment settings instead.
//
//   npm run admin:password -- "your new password"
//   npm run admin:password -- "your new password" --print

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { applyAdminCredentials } from "../src/lib/env-file";
import { hashPassword } from "../src/lib/password";

async function main() {
  const args = process.argv.slice(2);
  const print = args.includes("--print");
  const password = args.find((a) => !a.startsWith("--"));

  if (!password || password.length < 12) {
    console.error("Usage: npm run admin:password -- \"<password, 12+ characters>\" [--print]");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const secret = randomBytes(32).toString("base64url");

  if (print) {
    console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
    console.log(`SESSION_SECRET="${secret}"`);
    return;
  }

  const env = applyAdminCredentials(existsSync(".env") ? readFileSync(".env", "utf8") : "", hash, secret);
  writeFileSync(".env", env);
  console.log("Updated .env. Restart `npm run dev` to use the new password.");
}

main();
