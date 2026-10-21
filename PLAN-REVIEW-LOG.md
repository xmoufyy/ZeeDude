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
