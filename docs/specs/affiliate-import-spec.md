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
- **Parsing** (`src/lib/affiliate.ts`, pure). Revised after inspection 7, at the user's request to accept *any* text copied from the affiliate page.
  - **Card layout.** Each card is a name followed by a standalone `Wagered` word and the first amount after it. This works whether the copy puts labels and values on separate lines, on one line, in tab-separated columns, or flattens everything onto one line.
  - **Finding the name** (revised after inspection 9 R2). The text before `Wagered` is cut after the previous card's last date/time or `Comission`/`Generated`/`First Seen`/`Last Seen` label. The last non-empty line of what's left is the name, with verified ticks stripped.
    - That line is kept whole when it's on its own line, so `Agent 47 Smith` and `Mario4k` stay intact. A line that is only a decimal amount (a leftover commission) isn't a name.
    - On the same line as the previous card's end (a flattened copy), only *leading* amounts are stripped, since they are that card's commission. An all-digit name alone there is kept.
  - **Page totals.** `Wagered` text that appears before the first real card (one followed by `Generated`/`First Seen`/`Last Seen`) is page-total text. It's skipped with a warning. Anything after the first card counts, including a last card cut off early.
  - **Whole words only.** Labels and numbers count only as whole words, so names containing label words (`RegeneratedKing`) stay intact (inspection 8 R1).
  - **Amounts.** The amount after `Wagered` must be a complete number token. Something like `1e10` or `5.5.5` is an error, not truncated (inspection 8 R3).
  - **Simple lists.** With no `Wagered` card labels, it falls back to a strict `name, amount` / tab / 2+ space list. **Every** non-empty line must parse, or the paste is rejected. Only a first line that has a delimiter (`,` `;` or tab) and no digits is treated as a header (inspection 8 R2). On card copies, only a recognised list header (starting with a name column such as `username`/`name`/`player`, then a delimiter, no digits) hides a `Wagered` label, so a card line like `Alice<TAB>Wagered` still counts (inspection 9 R1).
  - Usernames are 1–64 characters with control characters removed. Amounts are finite, 0 to 1e9, and thousands separators are allowed.
  - The same name twice keeps the larger total, with a warning if they differ. Unreadable rows are errors, and any error blocks saving. Max 10,000 players.
- **Storage.**
  - New models `AffiliateSnapshot(takenAt)` and `AffiliateReading(snapshotId, username, key, lifetimeSol)`, unique on `(snapshotId, key)`, with cascade delete.
  - Postgres migration `0004_affiliate_snapshots`. SQLite stays on `db push`.
- **Weekly math.**
  - For a period: `latest` = newest snapshot with `takenAt <= endsAt + 1h`. If that is not after `startsAt + 1h`, the period has no data yet. A copy within the hour around the start is the period's starting point, never its latest, so the Sunday copy never counts the previous week's last bets in the new week. This was found in the post-inspection audit, and it replaces the inspection-8 R5 handling, which counted pre-start bets.
  - `baseline` = the snapshot with `takenAt` strictly earlier than `latest.takenAt` that is closest to `startsAt`, on either side. Copies sharing a `takenAt` are ordered by `createdAt`, so the later save is `latest`.
  - Copies sharing a `takenAt` are re-saves of one moment. Only the last saved one counts, as latest or as baseline, so a correction at the baseline time replaces the original (inspection 8 R4).
  - Copies before the start are not limited by age (inspection 7 R2). The two newest distinct copy times before `startsAt` are candidates, so a latest copy taken just before the start still finds its baseline (inspection 8 R5).
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
