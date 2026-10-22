# Plan Review Log

- Started: 2026-10-21
- Mode: review (`/claudex-loop:codex-review`)
- Host / planner / coordinator: Claude (Claude Code desktop)
- Plan reviewer: Codex (codex-cli 0.163.0), model and effort from the CLI's own configuration (none requested)
- Builder (if later authorized): Claude. Final inspector: fresh Codex session
- Plan: `D:\zee\PLAN.md` (Stage 4: polish, Postgres, deployment)
- Scope / authorization: plan review only. No implementation is authorized by this invocation
- Round limit: 5
- Runner artifacts: kept outside the repo, in the session scratchpad

## Rounds

### Round 1: Codex, verdict REVISE

- Result: `scratchpad/claudex/round1/claudex-q5iqq7fa/result.json`
- Session `01a16068-1390-72a0-8639-f88fd9685780`. Effective model `gpt-6.1-sol`, effort medium, read-only sandbox (from the rollout; no model was requested). 94s
- Plan SHA256 reviewed: `b7a4208e761f62f0dfa4124195db2f39d546343156bb64a78f7460455b9d91ba`
- Summary: "The plan leaves concrete authentication, concurrency, and Docker packaging defects unresolved."

| ID | Sev | Finding (short) | Disposition |
|---|---|---|---|
| R1 | medium | `set-admin-password.ts` keeps an empty `SESSION_SECRET=""` from `.env.example`, so login stays disabled on a fresh clone | **Accepted.** Confirmed at `scripts/set-admin-password.ts:42` and `.env.example:20`. Criterion 1 now requires regenerating a missing, empty or short secret, plus a fresh-clone login check |
| R2 | high | Login counts failures before inserting, so parallel requests bypass the limits | **Accepted.** Confirmed in `src/lib/auth.ts` `login()`. Criterion 13 now uses reserve-then-count in `login-limiter.ts`, proven by a 40-way concurrency check |
| R3 | medium | `ensureCurrentPeriod` and period create/update check overlap, then write, so duplicates are possible | **Accepted.** New criterion 17: serializable transaction plus retry, proven by a 10-way `ensureCurrentPeriod` check |
| R4 | high | Finalize and entry edits check state outside the write transaction; a second finalize can delete paid payouts | **Accepted.** Criterion 17: compare-and-set on `finalizedAt` inside the transaction, and `assertEditable` inside the entry writes |
| R5 | high | Reopen/delete check paid status before deleting, racing with mark-paid | **Accepted.** Criterion 17: the paid check runs inside the same serializable transaction; mark-paid requires a finalized period inside its own transaction; tested with mark-paid racing reopen |
| R6 | medium | Docker plan omits `public/` and `.next/static` (standalone doesn't copy them) | **Accepted.** Criterion 8 copies both. `verify:postgres` runs the standalone layout and checks assets. Follow-on: `npm start` now uses `start-standalone.mjs`, since `next start` doesn't support standalone output |

Other host edits in this round (follow-on consistency fixes):
- Lighthouse and verification commands now point at `npm start` (standalone) instead of `next start`.
- Added a risk note about SQLite relative paths under standalone.
- Merged the duplicate Docker risk lines.

### Round 2: Codex (resumed session), verdict APPROVED

- Result: `scratchpad/claudex/round2/claudex-dorbep5_/result.json`
- Same session `01a16068-1390-72a0-8639-f88fd9685780`, effective model `gpt-6.1-sol`. 44s
- Plan SHA256 approved: `13eeeb746975c65771ce6225fa5941624d118689ac908cd7d37010318bc58e73`
- Summary: "The revised plan addresses all six prior findings. No material unresolved defects were identified at the plan level; implementation correctness remains to be verified."
- Findings: none.
- Reviewer's stated limitations: this approves the plan, not an implementation. Postgres behaviour, Docker, browser login, standalone serving and Lighthouse were not run.
- Approval check: `runner.py check` → "Approval matches the current plan." (exit 0)

## Outcome

APPROVED after 2 of 5 rounds. Implementation is not yet authorized. If it goes ahead, Claude builds and a fresh Codex session inspects the final diff.

## Build

- Authorized by the user: "Build Stage 4 from the approved PLAN.md, then have a fresh Codex session inspect the final diff."
- Builder: Claude (host). Inspector: a fresh Codex session
- Pre-build commit (base): `ebd267f`
- Approved plan SHA256: `13eeeb746975c65771ce6225fa5941624d118689ac908cd7d37010318bc58e73`
- Build commits (base `ebd267f` → HEAD):
  - `a49f51d` plan + log
  - `8f6e1d4` session secret + limiter
  - `fd6363b` atomic writes + concurrency verifier
  - `f535824` Postgres schema/migration/guards
  - `cc1acd3` standalone + Docker + verify:postgres + headers
  - `3cb029f` OG/icons/robots/sitemap/error pages
  - `a67621b` Lighthouse script
  - `792bf1f` docs
- Authorship: all code by Claude (host builder).

### Proof results (host-run)

| Check | Result |
|---|---|
| `npm test` | 9 files, 81 tests passed |
| `npx eslint`, `npx tsc --noEmit` | clean |
| `npm run build` (SQLite) | compiled |
| `npm run verify:concurrency` (SQLite) | 4/4 scenarios PASS × 5 repeats |
| `npm run verify:postgres` (embedded Postgres 17) | migrate deploy OK; 4/4 concurrency PASS; `/`, `/history`, `/rules` 200 with seeded rows; static chunk, public asset and OG image 200; cron 401 without auth, 200 `ok:true` with it |
| `node scripts/lighthouse.mjs` (medians of 3) | mobile perf 97/97/98, desktop 100; a11y, best practices and SEO 100 on every page |
| Fresh clone (criterion 1) | `git clone` → `cp .env.example .env` → `npm install` → `admin:password` → `npm run dev -p 3005`: secret generated (blank placeholder replaced), UI login reached the Dashboard |
| Old/new comparison | `ebd267f` (`next start`) vs HEAD (standalone) on the same DB copy: `/`, `/history`, `/rules` same status and same leaderboard rows |
| Manual | OG image viewed (readability fixed: satori ignores `inset`); headers via `curl -I`; robots/sitemap; 404; error boundary through a temporary throwing route (removed) |

Deviations and additions vs the plan:
- `scripts/prisma.mjs` skips `generate` when the client already matches the schema and Prisma version (`clientIsCurrent`). Added because a running dev server on Windows locks the engine file (EPERM). `PRISMA_FORCE_GENERATE=1` overrides it.
- OG image: the banner is pre-darkened and blurred in `brand-assets.mjs`, the default OG font is used (no bold weight available without committing a font file), and the overlay uses explicit coordinates. Output is about 1.1 MB PNG.
- `error.tsx` / `global-error.tsx` use the `retry` prop (the Next 16.4 docs' name), not `reset`.
- Not verified: the Docker image build and run (no Docker on this machine). The README says so.

### Inspection 1: fresh Codex session, verdict REVISE

- Result: `scratchpad/claudex/inspect1/claudex-bp8rfmwa/result.json`. Session `01a16083-1fc1-7872-85cc-4297e23be1dc`, effective model `gpt-6.1-sol` (medium), 107s
- Base `ebd267f`. Reviewer coverage: every manifest file, the 4 bitmap assets viewed, writers and readers traced. Limitations: nothing was executed.

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| R1 | medium | `resolveDatabaseUrl` hand-parses `.env`: misreads `DATABASE_URL="…" # comment` and ignores `.env.production`, so the wrapper could generate a SQLite client while Next reads Postgres | **Accepted.** Uses `util.parseEnv` plus Next.js env-file precedence, `--env-mode=production` for `build` and `db:deploy`, and passes the resolved URL to Prisma. Tests added (inline comment, CRLF, precedence). Plan criterion 4 revised |
| R2 | medium | Compose interpolates the raw `POSTGRES_PASSWORD` into a URL; `#`, `/` or `%` break it | **Accepted.** Compose passes the parts; the entrypoint percent-encodes them (round-trip checked with `p#ss/w%rd:@x`). Plan criterion 8 revised |
| R3 | medium | Rejected logins return before pruning, so a sustained lockout grows `LoginAttempt` without bound | **Accepted.** Prune on every attempt; reject without writing when already over the limit. The verifier now asserts that 20 attempts while locked write no rows. Plan criterion 13 revised |
| R4 | medium | `verify:postgres` kills the server without waiting and ignores the result of the SQLite client restore | **Accepted.** Waits for exit (SIGKILL fallback after 10s); a failed restore is a verifier failure. Plan criterion 7 revised |

Also fixed: `start-standalone.mjs` would set `DATABASE_URL` to the string `"undefined"` when it was unset.

Revised plan SHA256: `d67b7544358ae05fc5006797948acfa5d490ed028b528f9d5aeee11cff4b7627` (the build contract changed; the plan was not re-reviewed, and inspection 2 judges against it).

Re-run proofs after the fixes: `npm test` 84/84; eslint and tsc clean; `verify:concurrency` 4/4; `verify:postgres` all PASS, client restored to sqlite; `npm run build` OK.

### Inspection 2: fresh Codex session, verdict REVISE (inspection budget now exhausted)

- Result: `scratchpad/claudex/inspect2/claudex-tnya438d/result.json`. Session `01a1608b-4a82-73a2-ba00-d4ede2a7947d`, effective model `gpt-6.1-sol` (medium), 100s
- Inspected snapshot: HEAD `95e22a3` against base `ebd267f`, plan SHA `d67b7544…`. Inspection 1's R1–R4 aren't repeated.

| ID | Sev | Finding | Host position |
|---|---|---|---|
| R1 | medium | Only `DATABASE_URL` is resolved from Next env files; `DIRECT_URL` in `.env.production.local` never reaches Prisma (or a different `.env` value is used) | Valid. Affects local Postgres setups using env files; Vercel/Docker set real env vars |
| R2 | medium | `util.parseEnv` doesn't do Next's `${VAR}` expansion, so `DATABASE_URL="${POSTGRES_PRISMA_URL}"` would pick SQLite | Valid |
| R3 | medium | `ensure-dev-db` (and `seed`) construct PrismaClient from Prisma's own `.env` loading, not the resolved URL; a `.env.local` override can skip seeding | Valid |
| R4 | medium | README/entrypoint promise an external `DATABASE_URL` override, but compose doesn't forward `DATABASE_URL`/`DIRECT_URL` | Valid (docs and behaviour mismatch) |

Proposed fix (not applied: no inspection rounds left to review it): load the full environment with `@next/env` `loadEnvConfig` (Next's own precedence and expansion) in `prisma.mjs`, `db-deploy.mjs`, `ensure-dev-db.ts`, `seed.ts` and `start-standalone.mjs`, and pass it to the Prisma subprocesses; forward optional `DATABASE_URL`/`DIRECT_URL` in compose and document the external-database setup.

**Status:** not approved by inspection. Four medium findings are open. The pending decision is the user's: fix now with an extra inspection round, fix without re-inspection, or accept as-is.

## Fix round 2 (user-authorized extra inspection)

User: "Fix the 4 open findings with @next/env loading and the compose change, then run one more fresh Codex inspection."

| ID (inspection 2) | Fix |
|---|---|
| R1 DIRECT_URL not resolved | `scripts/project-env.mjs` loads the **whole** env with `@next/env` `loadEnvConfig` (pinned dependency `@next/env@16.4.2`); `prisma.mjs` and `db-deploy.mjs` pass the full env to Prisma. Test: `DIRECT_URL` from `.env.production.local` beats `.env` |
| R2 no `${VAR}` expansion | Same loader, so Next's expansion applies. Tests: `DATABASE_URL="${POSTGRES_PRISMA_URL}"` resolves; `prisma.mjs which-schema --env-mode=production` picks Postgres from an expanded `.env.production` |
| R3 ensure-dev-db/seed used a different DB | Side-effect import `scripts/load-env.mjs` placed **before** `@prisma/client` (the client's import loads `.env` itself, which pre-empted `.env.local`; my first attempt missed this and the manual check caught it). `@next/env` is loaded via `createRequire` (a default import was `undefined` under tsx; a regression test runs under tsx). Manual proof: a temp `.env.local` → `r3-check.db` was created, pushed and seeded (4 periods); `dev.db` untouched |
| R4 compose ignored external DATABASE_URL | Compose forwards optional `DATABASE_URL`/`DIRECT_URL`; `POSTGRES_PASSWORD` is no longer a compose-level hard requirement; documented the `--no-deps app cron` external-DB flow (README, compose header, `.env.docker.example`). Not runnable here (no Docker) |

Plan updated (criteria 4 and 8). New plan SHA256: `0d9e6b6182f0158a283f2ed6e04ea24ebc970483fd9b4b17199f9b9770d9143a`.

Proofs re-run: tsc and eslint clean; `npm test` 88/88 (10 files); `verify:concurrency` 4/4; `verify:postgres` 14/14 PASS, client restored to sqlite; SQLite build plus `npm start` smoke (/, /history, /rules 200 with data); `npm run dev` (predev via load-env) serves 200.

### Inspection 3: fresh Codex session (user-authorized extra round), verdict REVISE

- Result: `scratchpad/claudex/inspect3/claudex-tnsbivdd/result.json`. Session `01a16094-6773-7413-a2fc-516cf016b1b9`, effective model `gpt-6.1-sol` (medium), 69s
- Snapshot: HEAD `9181fbe` vs base `ebd267f`, plan SHA from fix round 2. Reviewer: all 57 manifest entries, 4 bitmaps viewed, env loading traced end to end.

| ID | Sev | Finding | Host position |
|---|---|---|---|
| R1 | high | Dockerfile `deps` stage copies only `prisma.mjs` + `prisma-schema.mjs`, but `prisma.mjs` now imports `project-env.mjs`, so `postinstall` fails and the image can't build | **Valid. Regression from fix round 2.** Confirmed at `Dockerfile:18`. Fix: also copy `scripts/project-env.mjs` |
| R2 | medium | `predev` never regenerates the client: after `npm run build` with Postgres in `.env.production`, `npm run dev` on SQLite uses the Postgres client and fails | **Valid** (needs a Postgres `.env.production` locally). Fix: `predev` = `node scripts/prisma.mjs generate && tsx prisma/ensure-dev-db.ts` (generate is skipped when the client already matches) |

**Status:** not approved. 2 findings open (1 high). Waiting on the user's decision; no unreviewed edits made.

## Fix round 3 (user-authorized: "Fix the Dockerfile copy and the predev generate step, then run one more fresh Codex inspection.")

- R1 (high): the Dockerfile `deps` stage now also copies `scripts/project-env.mjs`. Proof (no Docker here): an isolated folder holding only the deps-stage files (package files, `prisma/`, the 3 scripts, node_modules junction) runs `node scripts/prisma.mjs which-schema` → `prisma/postgres/schema.prisma`, exit 0.
- R2: `predev` = `node scripts/prisma.mjs generate && tsx prisma/ensure-dev-db.ts`. Proof: deliberately generated a Postgres client, then `npm run predev` regenerated SQLite (`generatedClientProvider` postgresql → sqlite) and pushed/seeded OK; a second run skipped generation.
- eslint clean; `npm test` passes.
- Plan updated (criterion 6). New plan SHA256: `3d869a2ca9d8e279a47625a748d2d5ae51a1142f53115e18c64d893cdd63e3de`.
