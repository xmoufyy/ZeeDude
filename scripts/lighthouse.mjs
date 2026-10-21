// node scripts/lighthouse.mjs
// Lighthouse audit of the production build (PLAN.md criterion 14). Starts the
// standalone server (`npm start`) on a free port, runs 3 passes per page and
// form factor, and compares the median scores with the targets. Run
// `npm run build` first. JSON reports go to the OS temp dir, not the repo.
// Set CHROME_PATH if Chrome isn't in the default location.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const LH_CLI = path.join(path.dirname(require.resolve("lighthouse/package.json")), "cli/index.js");
const PAGES = ["/", "/history", "/rules"];
const RUNS = 3;
const TARGETS = {
  mobile: { performance: 90, accessibility: 95, "best-practices": 95, seo: 95 },
  desktop: { performance: 95, accessibility: 95, "best-practices": 95, seo: 95 },
};
const CHROME =
  process.env.CHROME_PATH ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(
    existsSync,
  );

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function main() {
  if (!CHROME) throw new Error("Chrome not found. Set CHROME_PATH.");
  const outDir = path.join(tmpdir(), "zd-lighthouse");
  mkdirSync(outDir, { recursive: true });

  const port = await freePort();
  const base = `http://localhost:${port}`;
  const server = spawn(process.execPath, ["scripts/start-standalone.mjs"], {
    env: { ...process.env, PORT: String(port), HOSTNAME: "localhost" },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(`${base}/rules`)).ok) break;
      } catch {
        // starting
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    let failed = 0;
    for (const formFactor of ["mobile", "desktop"]) {
      for (const page of PAGES) {
        const scores = { performance: [], accessibility: [], "best-practices": [], seo: [] };
        for (let run = 1; run <= RUNS; run++) {
          const file = path.join(outDir, `${formFactor}${page.replace(/\//g, "_") || "_"}-${run}.json`);
          const args = [
            LH_CLI,
            base + page,
            "--output=json",
            `--output-path=${file}`,
            "--only-categories=performance,accessibility,best-practices,seo",
            "--chrome-flags=--headless=new --no-first-run",
            "--quiet",
            ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
          ];
          const result = spawnSync(process.execPath, args, { env: { ...process.env, CHROME_PATH: CHROME }, stdio: "inherit" });
          if (result.status !== 0) throw new Error(`Lighthouse failed on ${formFactor} ${page}`);
          const report = JSON.parse(readFileSync(file, "utf8"));
          for (const key of Object.keys(scores)) scores[key].push(Math.round(report.categories[key].score * 100));
        }
        const line = Object.entries(scores)
          .map(([key, values]) => {
            const m = median(values);
            const ok = m >= TARGETS[formFactor][key];
            if (!ok) failed++;
            return `${key} ${m}${ok ? "" : ` (< ${TARGETS[formFactor][key]})`} [${values.join("/")}]`;
          })
          .join(", ");
        console.log(`${formFactor.padEnd(7)} ${page.padEnd(9)} ${line}`);
      }
    }
    console.log(`Reports: ${outDir}`);
    if (failed) {
      console.error(`${failed} score(s) below target`);
      process.exitCode = 1;
    }
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
