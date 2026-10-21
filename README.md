# ZeeDude SolPump Wager Leaderboard

Weekly SolPump wager race for the ZeeDude community. Players who sign up with code **ZEEDUDE** compete by total SOL wagered; the top 10 win a share of the prize pool.

> Work in progress. Stage 1 (public UI) and Stage 2 (admin panel) are done. Data providers, polish, and deployment docs come next.

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
