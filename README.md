# ZeeDude SolPump Wager Leaderboard

Weekly SolPump wager race for the ZeeDude community. Players who sign up with code **ZEEDUDE** compete by total SOL wagered; the top 10 win a share of the prize pool.

> Work in progress. Stages 1-3 (public UI, admin panel, data providers + cron) are done. Polish and deployment docs come next.

## Quick start

Requires Node 22+.

```bash
cp .env.example .env
npm install
npm run admin:password -- "choose-a-strong-password"
npm run dev
```

Open http://localhost:3000. The first `npm run dev` creates a local SQLite database (`prisma/dev.db`) and fills it with demo data: a live week plus three finished weeks. The admin panel is at http://localhost:3000/admin.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Sync the DB schema, seed if empty, start the dev server |
| `npm test` | Unit tests (ranking, ties, exclusions, payout rounding, time zones) |
| `npm run db:seed` | Wipe the local DB and reseed demo data |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run admin:password -- "<pw>"` | Set the admin password (writes the hash to `.env`; add `--print` to get values for a production host) |
| `npm run build` | Production build |

## Admin panel

Go to `/admin` and log in with the password you set.

| Page | What you can do |
| --- | --- |
| Dashboard | See the live race, refresh the public cache, toggle username masking, see unpaid prizes |
| Periods | Create races (dates in Eastern Time, prize pool, payout split). Overlapping dates are refused |
| Period detail | Import CSV/JSON, add/edit/remove players, preview standings with real names, end the race to lock winners, mark prizes paid with a tx note, reopen, delete |
| Excluded users | Ban cheaters, staff and alts from every leaderboard |

### Importing wager data

Upload or paste a CSV or JSON export. Headers are matched loosely: you need a username column (`username`, `user`, `player`, ...) and a SOL column (`wagered`, `Wagered (SOL)`, `total_wagered`, `volume`, ...). A USD column is optional. Values like `1,234.5 SOL` are fine. If any row is invalid, nothing is imported and you get the bad line numbers. Duplicate usernames in one file are added together.

- **Replace** (default): the file is the whole leaderboard. Players missing from it are removed.
- **Merge**: only players in the file are updated or added.

```csv
username,wagered,wagered_usd
SolSurfer,12.5,2400
DegenDave,8.25,
```

### Ending a race

Ending a race locks the standings into a final snapshot and creates a payout row for every winner. After that, bans and data edits don't change its results. To fix a mistake, reopen it (only possible while no prize is marked paid), correct the data, and end it again.

### Security

- One admin password, stored only as a salted scrypt hash (`ADMIN_PASSWORD_HASH`).
- Sessions are HMAC-signed, httpOnly, SameSite=strict cookies that last 12 hours. Changing the password signs everyone out.
- Logins are rate-limited: 5 failures per IP (and 30 overall) per 15 minutes.
- Every admin page and Server Action re-checks the session.
- CSRF: Server Actions only accept same-origin POSTs (Next.js checks `Origin` against `Host`), on top of SameSite=strict cookies.
- All inputs are validated with zod.

## Data sources

Wager data comes through providers (`src/lib/providers/`). Each one returns `{ username, wagered, rank }[]` for a period, with `wagered` in SOL and an optional `wageredUsd`.

| Provider | How data arrives | Status |
| --- | --- | --- |
| `CsvImportProvider` | Admin uploads/pastes a CSV or JSON export | **In use** |
| `ManualProvider` | Admin adds and edits rows by hand; reads what's stored | **In use** (default `DATA_PROVIDER=manual`) |
| `SolpumpApiProvider` | Pulled from an official SolPump partner API by the cron job | Stub. Refuses to run and never calls the network |

**Switching to the SolPump API** (only with official partner access, never by scraping private endpoints):
1. Fill in `request()` and `responseSchema` in `src/lib/providers/solpump-api.ts` from the API docs, set `IMPLEMENTED = true`, and add a test with a sample response.
2. Set `SOLPUMP_API_URL`, `SOLPUMP_API_KEY` and `DATA_PROVIDER=api`.
3. Each cron run then replaces the open periods' totals with the API's data. File import and manual edits still work as overrides between runs.

### Scheduled refresh

`GET /api/cron/refresh` with `Authorization: Bearer $CRON_SECRET` runs one refresh:
1. Creates this week's period if it's missing, copying the last period's prizes (turn off with `AUTO_CREATE_PERIODS=false`).
2. With `DATA_PROVIDER=api`, fetches fresh totals for every open period.
3. Saves a snapshot and expires the public cache.

The admin dashboard's **Refresh now** button runs the same steps.

- **Vercel:** `vercel.json` schedules it every 10 minutes and Vercel adds the auth header itself. Sub-daily crons need a Pro plan. On Hobby, use an external scheduler (cron-job.org, GitHub Actions, ...) that sends the header.
- **Anywhere else:** call it every 5-15 minutes, e.g.
  ```bash
  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/refresh
  ```

In manual mode there's nothing to pull, so the cron job only creates periods, takes snapshots and refreshes the cache.

### When something fails

- **Data source fails** (e.g. API down): existing totals are kept, the dashboard shows the error, and the public page shows *"Data may be delayed"* until a later run succeeds.
- **Database or cache fails:** public pages serve the last good copy, kept in memory and on disk in `FALLBACK_CACHE_DIR` (default: OS temp dir), with the same notice. Pages never show an error just because the DB is briefly unreachable, as long as they've loaded successfully once.
- **Stale data:** if a live race hasn't been updated for `DATA_STALE_AFTER_MINUTES` (default 24h), the notice appears too, as a nudge to import.

## How it works

- **Periods** run weekly, Sunday 5:00 PM to Sunday 5:00 PM Eastern (DST-aware, see `src/lib/period.ts`).
- **Ranking** (`src/lib/ranking.ts`): highest SOL wagered first. Excluded users are removed before ranking, so they never take a prize slot. Ties share a rank.
- **Payouts** (`src/lib/payouts.ts`): the pool is split by percentage in integer lamports, so prizes always add up to exactly the pool. Tied players split the combined prize of the places they occupy.
- **Past periods** are stored as final snapshots so results don't change later.
- Usernames are partly masked (`Ze****an`) by default.

## Project layout

```
prisma/          schema, seed script
src/app/         pages: / (leaderboard), /history, /rules
src/components/  UI pieces (podium, table, countdown, ...)
src/lib/         ranking, payouts, masking, periods, data access
docs/            reference notes
```
