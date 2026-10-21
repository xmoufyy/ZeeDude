// Loads .env files exactly the way Next.js does, using Next's own loader
// (@next/env): same file precedence, ${VAR} expansion, and the real
// environment always wins over files. Every script that talks to the
// database calls this first, so the Prisma schema choice, Prisma's own
// connection (DATABASE_URL and DIRECT_URL), and the app all see one config.
//
//   development: .env.development.local > .env.local > .env.development > .env
//   production:  .env.production.local  > .env.local > .env.production  > .env

import { createRequire } from "node:module";

// @next/env is CommonJS. require() loads it the same way under plain Node
// and under tsx (where a default import comes back undefined).
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env");
const quiet = { info() {}, error: (...args) => console.error(...args) };

/**
 * "production" when NODE_ENV says so or --env-mode=production was passed.
 * @param {string[]} [args]
 * @param {Record<string, string | undefined>} [env]
 */
export function envMode(args = [], env = process.env) {
  return args.includes("--env-mode=production") || env.NODE_ENV === "production" ? "production" : "development";
}

/**
 * Loads the project's env files into process.env and returns it.
 * @param {"production" | "development"} mode
 * @param {string} [dir]
 */
export function loadProjectEnv(mode, dir = process.cwd()) {
  loadEnvConfig(dir, mode === "development", quiet, true);
  return process.env;
}
