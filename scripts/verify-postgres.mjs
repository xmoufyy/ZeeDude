// npm run verify:postgres
// End-to-end proof of the production Postgres path, using a throwaway
// embedded Postgres (no Docker or real database needed):
//   1. start Postgres in a temp dir on a free port
//   2. generate the Postgres client, apply migrations (migrate deploy)
//   3. run the concurrency checks (scripts/verify-concurrency.ts)
//   4. seed demo data, production build, start the standalone server
//   5. HTTP checks: pages, static assets, OG image, cron auth
//   6. clean up and regenerate the SQLite client for local dev
//
// Stop `npm run dev` first on Windows: the running dev server locks Prisma's
// engine file, so regenerating the client would fail.
// Set VERIFY_DATABASE_URL to use an existing disposable Postgres instead
// (it will be WIPED).

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareStandalone } from "./standalone.mjs";

const require = createRequire(import.meta.url);
const NEXT_CLI = require.resolve("next/dist/bin/next");

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const failures = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(name);
}

/**
 * Runs one step as a child process WITHOUT blocking this process's event loop.
 * The embedded Postgres is our child too, and its log output is drained by our
 * event loop: a synchronous spawn freezes that, Postgres's log pipe fills up
 * (conflict-heavy scenarios log an error per serialization failure), and every
 * Postgres connection then stalls mid-write. Hence async spawn, with a hard limit.
 */
function step(name, args, env, timeoutMs = 20 * 60_000) {
  console.log(`\n> ${name}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${name} timed out after ${timeoutMs / 60_000} minutes`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${name} failed (exit ${code})`));
    });
  });
}

async function waitFor(url, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server didn't come up at ${url}`);
}

/** Kill the server and wait until it has really exited (it holds Prisma's engine open). */
async function stopServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  const timedOut = await Promise.race([exited.then(() => false), new Promise((r) => setTimeout(() => r(true), 10_000))]);
  if (timedOut) {
    child.kill("SIGKILL");
    await exited;
  }
}

async function main() {
  const tmp = mkdtempSync(path.join(tmpdir(), "zd-verify-pg-"));
  let pg = null;
  let server = null;
  const baseEnv = { ...process.env };

  try {
    let databaseUrl = process.env.VERIFY_DATABASE_URL;
    if (!databaseUrl) {
      const { default: EmbeddedPostgres } = await import("embedded-postgres");
      const port = await freePort();
      const password = randomBytes(12).toString("hex");
      pg = new EmbeddedPostgres({
        databaseDir: path.join(tmp, "data"),
        port,
        user: "postgres",
        password,
        persistent: false,
        onLog: () => {},
      });
      console.log(`> starting embedded Postgres on port ${port}`);
      await pg.initialise();
      await pg.start();
      await pg.createDatabase("zeedude");
      databaseUrl = `postgresql://postgres:${password}@localhost:${port}/zeedude`;
    }

    const cronSecret = randomBytes(24).toString("base64url");
    const env = {
      ...baseEnv,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      CRON_SECRET: cronSecret,
      NODE_ENV: "production",
      VERIFY_CONCURRENCY_THROWAWAY: "1",
    };

    await step("generate Postgres client", ["scripts/prisma.mjs", "generate"], env);
    await step("migrate deploy", ["scripts/db-deploy.mjs"], env);
    if (pg) {
      // Drift check: replaying every committed migration on a scratch database
      // must produce exactly the schema (--exit-code fails on any difference).
      await pg.createDatabase("shadow");
      const shadowUrl = databaseUrl.replace(/\/zeedude$/, "/shadow");
      await step(
        "migrations match the schema (drift check)",
        [
          require.resolve("prisma/build/index.js"),
          "migrate",
          "diff",
          "--from-migrations",
          "prisma/postgres/migrations",
          "--to-schema-datamodel",
          "prisma/postgres/schema.prisma",
          "--shadow-database-url",
          shadowUrl,
          "--exit-code",
        ],
        env,
      );
    }
    await step("concurrency checks (Postgres)", ["--conditions=react-server", "--import", "tsx", "scripts/verify-concurrency.ts"], env);
    await step("seed demo data", ["--import", "tsx", "prisma/seed.ts", "--force-wipe"], env);
    await step("production build", [NEXT_CLI, "build"], env);

    const standalone = prepareStandalone();
    const port = await freePort();
    const base = `http://localhost:${port}`;
    console.log(`\n> starting standalone server on ${base}`);
    server = spawn(process.execPath, [path.join(standalone, "server.js")], {
      env: { ...env, PORT: String(port), HOSTNAME: "localhost" },
      stdio: ["ignore", "inherit", "inherit"],
    });
    await waitFor(`${base}/rules`);

    for (const page of ["/", "/history", "/rules"]) {
      const res = await fetch(base + page);
      const html = await res.text();
      check(`GET ${page} -> 200`, res.status === 200, `got ${res.status}`);
      if (page !== "/rules") {
        check(`GET ${page} shows seeded players`, /\w{2}\*{4}/.test(html) && !html.includes("Data may be delayed"));
      }
    }

    const home = await (await fetch(base)).text();
    const chunk = /\/_next\/static\/[^"]+\.js/.exec(home)?.[0];
    check("static JS chunk served", !!chunk && (await fetch(base + chunk)).status === 200, chunk ?? "no chunk found");
    check("public/ asset served", (await fetch(`${base}/brand/zeedude-logo.webp`)).status === 200);
    const og = await fetch(`${base}/opengraph-image`);
    check("Open Graph image served", og.status === 200 && /image\//.test(og.headers.get("content-type") ?? ""), og.headers.get("content-type") ?? "");

    const noAuth = await fetch(`${base}/api/cron/refresh`);
    check("cron without auth -> 401", noAuth.status === 401, `got ${noAuth.status}`);
    const withAuth = await fetch(`${base}/api/cron/refresh`, { headers: { Authorization: `Bearer ${cronSecret}` } });
    const body = await withAuth.json().catch(() => ({}));
    check("cron with auth -> 200 ok:true", withAuth.status === 200 && body.ok === true, JSON.stringify(body));
  } finally {
    await stopServer(server);
    if (pg) await pg.stop().catch((error) => console.error("Couldn't stop embedded Postgres:", error));
    rmSync(tmp, { recursive: true, force: true });
    // Leave local dev as it was: SQLite client from .env. A failure here is a
    // verifier failure, since dev would otherwise be left on the Postgres client.
    console.log("\n> restoring the SQLite Prisma client");
    const restoreEnv = { ...baseEnv };
    delete restoreEnv.DATABASE_URL;
    delete restoreEnv.NODE_ENV;
    const restore = spawnSync(process.execPath, ["scripts/prisma.mjs", "generate"], { stdio: "inherit", env: restoreEnv });
    if (restore.status !== 0) {
      failures.push("restore SQLite Prisma client");
      console.error("Restoring the SQLite client failed. Stop any running dev server, then run: npm run postinstall");
    }
    console.log("Note: .next now holds a Postgres build. Run `npm run build` again before `npm start` on SQLite.");
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("\nAll Postgres checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
