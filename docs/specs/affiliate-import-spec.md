# Spec: SolPump affiliate import, Rules button, and deploy fixes

Inspection contract for work after `0a78e1c` (the last Codex-inspected state, inspection 6). This spec records what the user asked for and decided; it was not plan-reviewed before building. Inspection 6's two open findings (R1 verifier timeout, R2 normalized-key length) are out of scope here. The uncommitted `@vercel/analytics` dependency in `package.json` was added by the user outside this work and is out of scope.

## 1. Game weighting note and Rules button (`feaed40`, `1c8e508`)

User request: show on the leaderboard that Blackjack counts 20% of wager and Crash, Coinflip, Keno and Mines count 100%, using a "Rules" pill like their screenshot, placed sensibly rather than floating.

- `src/lib/game-weights.ts` is the single list; the home page pill (`src/components/game-rules.tsx`) and the Rules page FAQ both read it.
- The pill is a native `<details>` (works without JS), sits at the right of the "This Week's Leaderboard" heading, and its panel must stay on screen at 375px width.
- **Display only.** The user confirmed SolPump already applies the 20% Blackjack weighting in the wagered totals it reports, so the site never re-weights numbers.

## 2. SolPump affiliate-list import (`dfa5f7b`)

Context: SolPump's affiliate page lists each referral's **all-time** wagered total (name, "Wagered", amount, commission, first/last seen). Periods run weekly, Sunday 5 PM Eastern. The user asked for a paste import with lifetime snapshots and weekly baselines. Scraping SolPump or calling private endpoints is forbidden (original brief); the admin copies the visible page by hand.

Requirements:
- **Parsing** (`src/lib/affiliate.ts`, pure).
  - Reads a pasted page copy: a name line followed by `Wagered` plus an amount, on the same line or the next. Commission, dates, avatar text and verified ticks are ignored or stripped.
  - Falls back to `name, amount` / tab / 2+ space lines only when no `Wagered` label exists.
  - Usernames are 1–64 characters with control characters removed. Amounts are finite, 0 to 1e9, and thousands separators are allowed.
  - The same name twice keeps the larger total, with a warning if they differ. Unreadable rows are errors, and any error blocks saving. Max 10,000 players.
- **Storage.**
  - New models `AffiliateSnapshot(takenAt)` and `AffiliateReading(snapshotId, username, key, lifetimeSol)`, unique on `(snapshotId, key)`, with cascade delete.
  - Postgres migration `0004_affiliate_snapshots`. SQLite stays on `db push`.
- **Weekly math.**
  - For a period: `latest` = newest snapshot with `takenAt <= endsAt + 1h`. If that is before `startsAt - 1h`, the period has no data.
  - `baseline` = the snapshot taken before `latest` that is closest to `startsAt`, on either side.
  - Each player's wager = latest − baseline, computed in lamports.
  - Players absent from the baseline count in full; zero rows are dropped; negative differences count as 0 with a warning.
  - Warn when baseline players are missing from the latest copy (incomplete paste), and when the baseline is more than 1h from `startsAt`.
  - With no baseline (only one usable copy), the period's leaderboard is **left untouched**.
- **Applying.**
  - Saving a snapshot, or deleting one, recomputes every open (non-finalized) period whose `endsAt + 1h >= takenAt`. For each period that has a baseline, it **replaces** that period's `WagerEntry` rows (source `affiliate`).
  - The snapshot write and all recomputes run in one serializable transaction, via `writeEntries(tx, …)` extracted from `saveEntries`.
  - Finalized periods are never changed. A copy time more than 5 minutes in the future is rejected.
- **Admin UI** (Admin → SolPump import, admin-only actions).
  - A textarea, plus an optional "copied at" Eastern time that defaults to now.
  - **Preview** computes outcomes without writing. **Save copy** asks for confirmation, writes, and refreshes the leaderboard cache.
  - A list of saved copies, each with Delete, which recomputes.
  - `ensureCurrentPeriod()` runs before preview and save, so the current week exists.
- **Proof.**
  - `src/lib/__tests__/affiliate.test.ts` covers parsing, snapshot picking and the subtraction.
  - The `verify-concurrency.ts` scenario covers, end to end on SQLite and Postgres:
    - the first copy leaves the board untouched
    - subtraction is correct
    - preview doesn't write
    - five parallel saves end on the newest copy
    - deleting the newest copy falls back to the previous one

## 3. Deployment fixes (Vercel Hobby + Prisma Postgres)

- **Daily cron** (`afda53d`): `vercel.json` cron runs `5 22 * * *`. Hobby rejects sub-daily crons. Manual imports don't need more, since the import ensures the current period.
- **Build guard and sign-in errors** (`d4fba25`).
  - `scripts/db-deploy.mjs` exits non-zero on Vercel (`VERCEL` set) when `DATABASE_URL` isn't `postgres(ql)://`, rather than silently `db push`-ing a SQLite file that can't work there.
  - Wallet sign-in shows only messages it authored (`SignInError`) or a generic retry line. Raw server and React errors, such as minified #441, are never shown to players.
- **Share previews** (`0707920`): `site.url` = `NEXT_PUBLIC_SITE_URL`, else `https://${VERCEL_PROJECT_PRODUCTION_URL}`, else `http://localhost:3000`, so `og:image` never points at localhost on Vercel. `site` is imported only by server code.

## 4. Verification commands

- `npx tsc --noEmit -p .`, `npx eslint`, `npx vitest run` (117 tests).
- `npm run verify:concurrency` (8 scenarios, SQLite).
- `npm run verify:postgres` (embedded Postgres: migrations, drift check, 8 scenarios, standalone build, HTTP checks). It passed after `dfa5f7b`.
