# ZeeDude SolPump Wager Leaderboard

Weekly SolPump wager race for the ZeeDude community. Players who sign up with code **ZEEDUDE** compete by total SOL wagered; the top 10 win a share of the prize pool.

> Work in progress. Stage 1 (public UI with seed data) is done. Admin panel, data import, and deployment docs come next.

## Quick start

Requires Node 22+.

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000. The first `npm run dev` creates a local SQLite database (`prisma/dev.db`) and fills it with demo data: a live week plus three finished weeks.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Sync the DB schema, seed if empty, start the dev server |
| `npm test` | Unit tests (ranking, ties, exclusions, payout rounding, time zones) |
| `npm run db:seed` | Wipe the local DB and reseed demo data |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run build` | Production build |

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
