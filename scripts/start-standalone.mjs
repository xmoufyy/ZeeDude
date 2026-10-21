// npm start
// Runs the production build. `next start` doesn't support output: "standalone",
// so this copies the static assets into place and runs .next/standalone/server.js.
// PORT and HOSTNAME work as usual (defaults: 3000, all interfaces).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { absoluteSqliteUrl, prepareStandalone } from "./standalone.mjs";

// Same env file behaviour as `next start`: real environment wins over .env.
for (const file of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
process.env.DATABASE_URL = absoluteSqliteUrl(process.env.DATABASE_URL);

const standalone = prepareStandalone();
const child = spawn(process.execPath, [path.join(standalone, "server.js")], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
