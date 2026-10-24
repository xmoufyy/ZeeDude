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

### Inspection 4: fresh Codex session, verdict REVISE

- Result: `scratchpad/claudex/inspect4/claudex-1bz8he1a/result.json`. Session `01a16189-9c9a-76f0-9e98-553845c6320a`, `gpt-6.1-sol`, 147s. Snapshot `dd0077a`.
- Confirms that inspection 3's R1 (Docker deps copy) and R2 (predev generate) are fixed.

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| R1 | medium | Compose doesn't forward `AUTO_CREATE_PERIODS` / `DATA_STALE_AFTER_MINUTES` (or the API settings) to `app` | **Fixed:** forwarded with documented defaults; added to `.env.docker.example` |
| R2 | medium | `absoluteSqliteUrl` only handles `./` and `../`, so `file:dev.db` breaks under `npm start` | **Fixed:** every relative path is pinned to `prisma/`, `?params` kept; `standalone.test.ts` added |
| R3 | medium | `readEnvValue` counts an inline comment as part of the secret, so `SESSION_SECRET="" # …` survives | **Fixed:** uses `util.parseEnv`; tests for empty and short secrets followed by comments |

These three fixes are **not yet independently inspected**: the user authorized one more inspection, and it's used. Proofs: `npm test` 93/93, tsc and eslint clean.

## New feature after the loop: My Profile + Dude Crew (user request, not plan-reviewed)

User request (mid-loop): add a "My Profile" tab with wallet/socials and a hide-my-name toggle, and a fun-named tab encouraging people to join the Discord. Decisions (user, via questions): Solana wallet sign-in; admin approves SolPump username claims; toggle = masked vs full name per player; tab name "The Dude Crew".

- Built by Claude. **No independent Codex inspection yet**; this also covers inspection 4's three fixes (`8d9ed5f`).
- Proof:
  - `npm test` 104/104 (new: solana-auth with real ed25519 keys + base58 vectors, profile schema, session subject)
  - tsc and eslint clean
  - `verify:concurrency` 4/4
  - `verify:postgres` 14/14 twice. It now includes a Prisma drift check (`--from-migrations` vs schema): "No difference detected" for migrations 0001 and 0002. One run logged a non-reproducing Next "unexpected cache miss" warning on `/history` while the page still served 200.
- Browser end-to-end with an injected WebCrypto Ed25519 "Phantom":
  - sign-in signed the server-stored nonce message; the session cookie is httpOnly
  - profile saved: claim pending, handles normalised
  - toggle survives saves in both directions (fixed a React form-reset desync)
  - unapproved claim → still masked
  - approved + show name → full "SolPump" name public
  - re-hide → masked immediately
  - profile stats showed rank, wager and paid prizes
- Admin Players page rendered pending/approve and approved/unverify states. Mobile 375px: no overflow; the Menu button opens all 5 tabs.
- Not verified: a real wallet extension (no Phantom in this browser) and the admin approve button clicked through the UI (approval was done via `reviewClaim` directly).

## Inspection 5: fresh Codex session (via /codex-review → user chose "inspect recent code")

- Contract: `docs/specs/profiles-crew-spec.md` (written for this inspection; not plan-reviewed). Base `dd0077a`, snapshot `63f1182`.
- Result: `scratchpad/claudex/inspect5/claudex-h3np5mcf/result.json`. Session `01a1624b-2471-7153-9b30-b1ba099e8ee9`, `gpt-6.1-sol`, 123s. Verdict **REVISE**.

| ID | Sev | Finding | Host position |
|---|---|---|---|
| R1 | high | Approve/reject is bound only to the player id, so a claim changed after the admin looked can be approved as a different name, and that wallet shows as the new name's payout wallet | **Valid.** Fix: bind the action to the reviewed `solpumpKey` and require the expected status inside the transaction |
| R2 | medium | Nonce prune, replace, cap check and create are separate steps: concurrent starts can leave 2 valid challenges per wallet or exceed the cap; `WalletNonce.wallet` isn't unique | **Valid.** Fix: one serializable transaction; `@unique` wallet (migration 0003) |
| R3 | medium | The outage fallback stores names as rendered, so after a player turns on hide-name a DB failure can serve their old full name | **Valid.** Fix: mask every name when serving from the fallback (fail closed) |

Status: open. Review only (no implementation authorized by this command).

### Fix round for inspection 5 (user-authorized: fix R1–R3, then one more fresh inspection)

- R1: `reviewClaim(playerId, decision, reviewedKey)` checks, inside the transaction, that the key matches what the admin reviewed and that the status fits the decision. Players page buttons bind the displayed key.
- R2: `src/lib/wallet-challenge.ts` prunes, replaces, cap-checks and creates in one serializable transaction. `WalletNonce.wallet` is `@unique` (migration `0003_unique_wallet_nonce` clears challenges first).
- R3: fallback copies are sanitized with every name masked, both when saved and when served (this covers older raw copies).
- Found while proving these: `verify:postgres` intermittently hung (once ~40 minutes; once at run 4 of the same-wallet scenario). Diagnosis: 600 standalone sign-in starts never stalled, so the cause was the harness, not the app. `spawnSync` froze the verifier's event loop, and the embedded Postgres (a child of the verifier) blocked on a full stderr log pipe after many serialization-failure log lines. Fix: async `step()`, plus per-step (20 min) and per-scenario (60 s) timeouts.
- Proofs: `npm test` 107/107; tsc and eslint clean; `verify:concurrency` 7/7 (new: stale-claim review, same-wallet starts, cap); `verify:postgres` 17/17 on two consecutive runs with the drift check clean for 3 migrations.

## Inspection 6: fresh Codex session, verdict REVISE (user-authorized extra round, now used)

- Result: `scratchpad/claudex/inspect6/claudex-x27nr7qf/result.json`. Session `01a16290-ec06-7231-bedc-74e43b26d43d`, `gpt-6.1-sol`, 193s. Snapshot `737bbdc`, base `dd0077a`.
- Confirms inspection 5's R1–R3 are fixed.

| ID | Sev | Finding | Host position |
|---|---|---|---|
| R1 | medium | `verify-concurrency` scenario timeout doesn't stop the stalled run: later scenarios can overlap it and the final `wipe()` can still hang; the SQLite launcher has no child timeout | **Valid** (test harness only). Fix: exit immediately on a timeout (skip cleanup), and/or give the launcher a child timeout |
| R2 | low | `reviewedKey` is capped at 64 UTF-16 units, but lowercasing can lengthen an accepted 64-character name (e.g. U+0130), so approve/reject always fail for such a claim | **Valid.** Fix: allow the normalized maximum (or validate the normalized length at save) and add a boundary test |

Status: 2 open. Awaiting the user's decision.

## Inspection 7: fresh Codex session, verdict REVISE

- Contract: `docs/specs/affiliate-import-spec.md` (written for this inspection; not plan-reviewed). Base `0a78e1c`, snapshot `cbd8b55`. Covers the Rules button, the SolPump affiliate import, the daily cron, the Vercel build guard, sign-in error messages and the share-preview URL.
- Result: `scratchpad/claudex/inspect7/claudex-2c0nuts4/result.json`, 56s. Verdict **REVISE**. Limitations reported: full suites and the browser layout were not rerun by the inspector.

| ID | Sev | Finding | Host position |
|---|---|---|---|
| R1 | high | In the `name, amount` fallback, malformed lines are silently skipped (`Alice, 100\nBob, nope` imports Alice only), so an incomplete copy can replace the board | **Valid.** Fix: in fallback mode every nonblank line must parse, else error; add a mixed valid/invalid test |
| R2 | medium | Snapshot query ignores copies older than 30 days before the period start, so after a long gap an existing baseline is missed and the board is left untouched | **Valid.** Fix: load in-window copies plus the newest copy before the start, with no age cutoff; test a >30-day-old baseline |
| R3 | medium | Two copies with the same `takenAt` can be chosen as latest and baseline (zero deltas wipe the board), and the choice depends on DB order | **Valid.** Fix: baseline must be strictly earlier than latest; break `takenAt` ties by `createdAt`; test repeated saves at one time |

Status: 3 open. Review only (no implementation authorized by this command).

### Fix round for inspection 7 (user-authorized: fix R1–R3, then one more fresh inspection)

- The user also asked mid-round that the importer accept *any* text copied from the affiliate page. The parser was rebuilt around standalone `Wagered` labels: each card is the name left after stripping dates, labels, standalone numbers and ticks, plus the first amount after `Wagered`. It handles separate-line, one-line, tab-separated and fully flattened copies. Page totals before the first card are skipped with a warning; a CSV header line isn't a card. Contract updated in `docs/specs/affiliate-import-spec.md` §2.
- R1: the simple `name, amount` list is strict. Every non-empty line must parse (an all-text first line counts as a header), otherwise nothing is saved.
- R2: `computePeriod` loads the copies from the period start onward plus the newest copy before the start, with no age cutoff.
- R3: `pickSnapshots` only takes a baseline strictly older than `latest`, and breaks equal `takenAt` ties by `createdAt` (so the later save wins).
- Proofs: `npm test` 121/121 (new tests: tab, flattened, page-total, all-digit-name, strict-list and same-time cases). tsc and eslint clean. `verify:concurrency` 8/8; the affiliate scenario now also re-saves at the same copy time (expects 51, not 1) and uses a 45-day-old baseline (expects 2.5, not an untouched board).

## Inspection 8: fresh Codex session, verdict REVISE (user-authorized extra round, now used)

- Result: `scratchpad/claudex/inspect8/claudex-d8u8rqfj/result.json`. Session `01a16771-6432-7ea1-8e18-54e8b5a92717`, 69s. Snapshot `5ec3ae7`, base `0a78e1c`. Postgres verification on `5ec3ae7`: all checks passed (drift clean, 8/8 scenarios, HTTP checks).
- Inspection 7's R1–R3 are not re-raised. The new findings are edge cases in the rebuilt parser and in the snapshot selection.

| ID | Sev | Finding | Host position |
|---|---|---|---|
| R1 | high | Label words inside names are treated as labels: `RegeneratedKing` imports as `King` | **Valid.** Fix: match labels only as standalone words; test names containing label words |
| R2 | high | `Bob nope\nAlice, 100` skips the bad first line as a "header" (no delimiter), contrary to the contract | **Valid.** Fix: a header needs a delimiter and no digits, else it's an error |
| R3 | medium | `Wagered 1e10` reads as 1 (only the numeric prefix is taken), bypassing the max check | **Valid.** Fix: the amount must be a complete token; reject malformed suffixes |
| R4 | medium | Copies sharing a `takenAt` at the *baseline* time: the original wins over its later correction | **Valid.** Fix: collapse same-`takenAt` copies to the latest saved before selecting latest and baseline; test it |
| R5 | medium | Only one pre-start copy is loaded: if the newest copy is 30 min before the start (so it becomes `latest`), the older baseline isn't loaded and the period is left untouched | **Valid.** Fix: also load the newest copy strictly older than that one; test it |

Status: 5 open. The authorized inspection budget is used.

### Fix round for inspection 8 (user-authorized: fix R1–R5, then one more fresh inspection)

- R1: labels in `NOISE`, `CARD_MARKER` and `LABEL` match only as whole words (Unicode letter/number boundaries), so `RegeneratedKing` stays intact.
- R2: in a simple list, a first line is a header only if it has a delimiter (`,` `;` tab) and no digits; anything else unreadable is an error.
- R3: `AMOUNT_AFTER` requires a complete number token (no letters, digits or `.`/`,`+digit right after), so `1e10` and `5.5.5` are errors.
- R4: `pickSnapshots` collapses copies sharing a `takenAt` to the last saved one before choosing latest and baseline.
- R5: `computePeriod` loads the newest copy before the start *and* the newest copy strictly older than that one.
- Proofs: `npm test` 124/124 (new: label-word names, malformed amounts, undelimited first line, baseline-time correction). tsc and eslint clean. `verify:concurrency` 8/8; the affiliate scenario now also covers a latest copy 30 min before the start with a baseline a week older (expects 4).

## Inspection 9: fresh Codex session, verdict REVISE (user-authorized extra round, now used)

- Result: `scratchpad/claudex/inspect9/claudex-cg4c51w8/result.json`. Session `01a16777-be6c-7d72-a951-6dde6cd7f2df`, 60s. Snapshot `d4a9be8`, base `0a78e1c`. Postgres verification on `d4a9be8`: 18/18 passed, drift clean.
- Inspection 8's R1–R5 are not re-raised.

| ID | Sev | Finding | Host position |
|---|---|---|---|
| R1 | high | The CSV-header rule (first line with a tab and no digits) also matches a card line like `Alice<TAB>Wagered` with the amount on the next line, so Alice is silently dropped | **Valid.** Fix: only a recognised list header (a name column word plus a delimiter) is skipped; test a tab-separated name and label |
| R2 | medium | `nameBefore` cuts at the last noise match, so a name with a standalone number inside (`Agent 47 Smith`) imports as `Smith` | **Valid.** Fix: cut only after the previous card's dates and labels, take the last line, then strip leading standalone numbers only; test it |

Status: 2 open. The authorized inspection budget is used.

### Fix round for inspection 9 (user-authorized: fix R1–R2, run the checks, no further inspection)

- R1: on card copies, only a recognised list header (`LIST_HEADER`: a name column, then a delimiter, no digits) hides a `Wagered` label on the first line.
- R2: `nameBefore` cuts only after the previous card's last date or label and keeps the name line whole. Leading amounts are stripped only on the same line as that cut (flattened copies). A line that is just a decimal amount isn't a name.
- Proofs: `npm test` 126/126 (new: tab after the first card's name; `Agent 47 Smith` on its own line and flattened; a leftover commission isn't a name). tsc and eslint clean. `verify:concurrency` 8/8. Database code is unchanged since `d4a9be8`, where `verify:postgres` passed 18/18.
- Not independently inspected: this round's parser changes. The user chose to skip a further Codex inspection.

## Site audit (host, after inspection 9) and fixes

- Live probe of `zeedude.vercel.app`:
  - all public pages, the OG image, robots and sitemap return 200
  - unknown pages return 404
  - admin pages redirect logged-out visitors with no data
  - cron rejects requests without the secret
  - social and referral links are correct
- Fixed (user-authorized), with tests:
  1. **High:** the Sunday boundary copy was the new week's `latest`, so the new week counted last week's final bets until the next paste. A copy within 1h of the start is now only a starting point. This also supersedes inspection 8 R5's handling, which counted pre-start bets. Preview and save still list the new week as "starting point".
  2. Empty podium spots on a live race show the place's prize ("Up for grabs") instead of 0.
  3. The countdown re-renders the page when a race starts or ends while open, retrying until the server's clock agrees.
  4. Past Winners marks ended-but-unconfirmed races as unofficial.
  5. An ended, finalized race links to Past Winners instead of "being locked in".
  6. "1 player" plural on Past Winners.
- Proofs:
  - `npm test` 131/131 (new: boundary-copy selection; podium and countdown render tests)
  - tsc and eslint clean
  - `verify:concurrency` 8/8; the affiliate scenario now runs the Sunday sequence (last-week copy, boundary copy, which leaves the board untouched, then a mid-week copy giving 1.5)
- Not independently inspected.

## Audit completion — Codex, 2026-10-24

- Authorized by the user: complete Claude's unfinished website audit from the pasted brief. Reviewed the main checkout plus Claude's uncommitted audit in `.claude/worktrees/zeedude-solpump-review-44a363`; retained that worktree and the user's analytics dependency changes.
- Full severity-ordered findings, selected usability improvements, evidence, and limitations: `docs/audits/2026-10-24.md`.
- Fixed confirmed import defects (decimal-comma inflation, commission columns, malformed first-row header detection, and silent omission of cards without metadata), incorrect reading freshness, the two inspection-6 loose ends (Unicode claim keys and verifier timeout handling), and misleading no-data display.
- User decision: **retain totals with a warning** after deleting the last usable reading or baseline. Implemented a persistent warning for open public boards using the same snapshot selection as recalculation; totals and reading timestamps are retained, and a usable replacement clears the warning. Updated the affiliate spec. No schema or migration change.
- Five focused usability groups: preserved form drafts, clearer wager freshness, local race times beside Eastern dates, improved mobile rank/name spacing and claim status, and visible clipboard-error recovery.
- Final proof: `npm test` **145/145** across 16 files; TypeScript, ESLint and diff whitespace checks clean; `verify:concurrency` **9/9 × 5** on SQLite; `verify:postgres` all checks passed (4 migrations, no drift, **9/9 × 5**, production build, seeded HTTP/asset and cron checks); separate final SQLite production build passed. Final generated client and build target SQLite.
- Regression evidence includes failed-before/passed-after parser and empty-podium tests; timestamp checks; retained-data/latest and baseline deletion/recovery checks; and unchanged finalized results/payouts after unrelated imports. A deliberately stalled temporary verifier exited 1 at 25ms without later checks or database cleanup.
- Browser proof: live public pages read-only; isolated production build with seeded data and test admin login; malformed paste retained after error; valid preview retained paste and timestamp; local race times and masked names rendered; retained 1.5 SOL and its old date shown with the warning. Screenshots retained under `docs/audits/`.
- Initial verification failures were resolved: sandbox Windows account lookup, missing SQLite file, Prisma DLL lock from overlapping verification, and a new fixture that incorrectly expected no baseline while an older baseline remained. Final runs passed with the intended assertions intact.
- Limitations: no real wallet extension, production admin session, Docker execution, or fresh narrow-mobile browser pass. No production changes or deployment. Temporary server and fixture data removed. No independent subagent inspection was run.
