# ZeeDude SolPump Wager Leaderboard

Weekly SolPump wager race for the ZeeDude community. Players who sign up with code **ZEEDUDE** compete by total SOL wagered; the top 10 win a share of the prize pool.

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 6 (SQLite locally, Postgres in production).

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
| `npm run dev` | Sync the SQLite schema, seed if empty, start the dev server (never touches a Postgres URL) |
| `npm test` | Unit tests: ranking, ties, payouts, time zones, import parsing, auth, limiter, schema sync |
| `npm run build` | Generate the Prisma client for `DATABASE_URL` and build (no database access) |
| `npm start` | Run the production build (standalone server; `PORT`/`HOSTNAME` supported) |
| `npm run db:deploy` | Bring the schema up to date: `migrate deploy` on Postgres, `db push` on SQLite |
| `npm run db:seed` | **Wipe** the DB and load demo data. Refuses Postgres/production without `-- --force-wipe` |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:sync-schema` | Regenerate `prisma/postgres/schema.prisma` after editing `prisma/schema.prisma` |
| `npm run admin:password -- "<pw>"` | Set the admin password in `.env` (add `--print` to get values for a production host) |
| `npm run verify:concurrency` | Race-condition checks against a throwaway SQLite DB |
| `npm run verify:postgres` | Full production path on a throwaway embedded Postgres (stop `npm run dev` first on Windows) |
| `node scripts/lighthouse.mjs` | Lighthouse audit of the production build (run `npm run build` first) |
| `node scripts/brand-assets.mjs` | Regenerate PNG/JPEG copies of the brand art after changing the WebP files |

## Admin panel

Go to `/admin` and log in with the password you set.

| Page | What you can do |
| --- | --- |
| Dashboard | See the live race and data source health, refresh now, toggle username masking, see unpaid prizes |
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
- Logins are rate-limited to 5 failures per client (and 30 overall) per 15 minutes. Each attempt is recorded *before* the password is checked, so parallel guesses can't slip past the limit. Once a client is locked out, further attempts are rejected without being stored, and rows older than 24 hours are pruned, so an attack can't grow the table without bound.
- The client IP comes from `x-vercel-forwarded-for` on Vercel, or from `X-Forwarded-For` only when `TRUST_PROXY_HEADERS=true`. Otherwise every request shares one bucket, so spoofed headers can't dodge the limit. Behind your own reverse proxy, set `TRUST_PROXY_HEADERS=true`.
- Every admin page and Server Action re-checks the session. Server Actions only accept same-origin POSTs (Next.js checks `Origin` against `Host`), on top of SameSite=strict cookies.
- Admin writes that check state first (overlaps, finalize, reopen, payments, entry edits) run in serializable transactions with retry, so double-clicks or a cron run at the same moment can't corrupt data. `npm run verify:concurrency` / `verify:postgres` prove this.
- Security headers on every route: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, and HSTS in production. A full script CSP isn't set: it would need per-request nonces, which turns off Partial Prerendering.
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

The admin dashboard's **Refresh now** button runs the same steps. In manual mode there's nothing to pull, so the job only creates periods, takes snapshots and refreshes the cache.

### When something fails

- **Data source fails** (e.g. API down): existing totals are kept, the dashboard shows the error, and the public page shows *"Data may be delayed"* until a later run succeeds.
- **Database or cache fails:** public pages serve the last good copy, kept in memory and on disk in `FALLBACK_CACHE_DIR`, with the same notice. On serverless hosts that copy is per instance, so it covers short outages on warm instances. Docker keeps it in a volume.
- **Stale data:** if a live race hasn't been updated for `DATA_STALE_AFTER_MINUTES` (default 24h), the notice appears too, as a nudge to import.

## Deploying to Vercel

1. Create a Postgres database (Neon, Supabase, Vercel Postgres, ...). Note the **pooled** URL and the **direct** (non-pooled) URL. Without a pooler, both are the same URL.
2. Import the repo in Vercel. `vercel.json` already sets the build command to `npm run db:deploy && npm run build`, so migrations run on each deploy.
3. Set environment variables (see the table below). At minimum: `DATABASE_URL`, `DIRECT_URL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`. Get the admin values with:
   ```bash
   npm run admin:password -- "your strong password" --print
   ```
4. Deploy. The cron in `vercel.json` calls `/api/cron/refresh` every 10 minutes and sends `CRON_SECRET` automatically. Sub-daily crons need a Pro plan; on Hobby, use an external scheduler (cron-job.org, GitHub Actions) that sends the header:
   ```bash
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/refresh
   ```
5. Log in at `/admin` and create the first period. The cron job creates each following week automatically.

Don't run `db:seed` against production: it deletes everything (it refuses unless you pass `--force-wipe`).

## Deploying with Docker

```bash
cp .env.docker.example .env.docker   # fill in the secrets
docker compose --env-file .env.docker up -d --build
```

This runs three containers: `app` (Next.js standalone server, runs `prisma migrate deploy` on start), `db` (Postgres 17 with a named volume), and `cron` (calls the refresh endpoint every 10 minutes). The app listens on `APP_PORT` (default 3000). The database password can contain any characters: compose passes it separately and the entrypoint builds a percent-encoded `DATABASE_URL`. Put it behind a TLS reverse proxy (Caddy, nginx, Cloudflare) and set `TRUST_PROXY_HEADERS=true` so login rate limiting sees real client IPs.

`NEXT_PUBLIC_*` values are baked in at build time; rebuild (`--build`) after changing them.

**External database** (managed Postgres instead of the bundled one): set `DATABASE_URL` (plus `DIRECT_URL` if it goes through a pooler) in `.env.docker`, leave `POSTGRES_PASSWORD` empty, and start only the app and cron:

```bash
docker compose --env-file .env.docker up -d --build --no-deps app cron
```

> **Unverified here:** the Docker image couldn't be built on the machine this was developed on (no Docker). The same standalone layout, migrations, and Postgres behaviour *are* exercised by `npm run verify:postgres`. Run `docker compose up --build` once and check `/`, `/admin/login` and the cron logs (`docker compose logs cron`) before relying on it.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` (SQLite, local) or a `postgresql://` URL (production). Picks the Prisma schema. Every script loads env files with Next.js's own loader (`@next/env`): same file order and `${VAR}` expansion as the app, and real environment variables win |
| `DIRECT_URL` | Postgres | Non-pooled Postgres URL for migrations. Same as `DATABASE_URL` without a pooler (Docker sets it automatically) |
| `ADMIN_PASSWORD_HASH` | yes | From `npm run admin:password` |
| `SESSION_SECRET` | yes | 32+ random characters; signs admin sessions |
| `CRON_SECRET` | yes | 16+ characters; bearer token for `/api/cron/refresh` |
| `NEXT_PUBLIC_SITE_URL` | yes (prod) | Public URL, used for metadata, sitemap and share images |
| `NEXT_PUBLIC_REFERRAL_CODE` / `_URL` | no | Default `ZEEDUDE` / `https://solpump.io/a/ZEEDUDE` |
| `NEXT_PUBLIC_DISCORD_URL` / `_X_URL` / `_KICK_URL` | no | Footer links; blank hides them |
| `DATA_PROVIDER` | no | `manual` (default) or `api` |
| `SOLPUMP_API_URL` / `SOLPUMP_API_KEY` | with `api` | Official partner API credentials |
| `AUTO_CREATE_PERIODS` | no | `false` stops the cron job creating each week's period |
| `DATA_STALE_AFTER_MINUTES` | no | When to show "may be delayed" for old data (default 1440) |
| `TRUST_PROXY_HEADERS` | no | `true` behind a reverse proxy that sets `X-Forwarded-For` |
| `FALLBACK_CACHE_DIR` | no | Where last-known-good copies are kept (default: OS temp dir) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | multi-instance | Same key on every instance so Server Actions work across them |

## Backups

Everything that matters (periods, wager data, payouts, exclusions) is in Postgres. Use your host's automatic backups, or schedule:

```bash
pg_dump --format=custom --file=zeedude-$(date +%F).dump "$DIRECT_URL"
```

Restore with `pg_restore --clean --dbname "$DIRECT_URL" zeedude-YYYY-MM-DD.dump`.

## Production checklist

- [ ] Strong admin password set via `--print`; `SESSION_SECRET` and `CRON_SECRET` are random and unique
- [ ] `NEXT_PUBLIC_SITE_URL` is the real HTTPS URL
- [ ] `npm run db:deploy` ran (Vercel build command / Docker entrypoint)
- [ ] Cron is calling `/api/cron/refresh` (check the admin dashboard's "Last refresh")
- [ ] `TRUST_PROXY_HEADERS=true` only if a proxy you control sets `X-Forwarded-For`
- [ ] Backups scheduled
- [ ] Rules page reviewed: payout method, timing and disqualification rules are still drafts
- [ ] Social links set, or left blank to hide them

## How it works

- **Periods** run weekly, Sunday 5:00 PM to Sunday 5:00 PM Eastern (DST-aware, see `src/lib/period.ts`).
- **Ranking** (`src/lib/ranking.ts`): highest SOL wagered first. Excluded users are removed before ranking, so they never take a prize slot. Ties share a rank.
- **Payouts** (`src/lib/payouts.ts`): the pool is split by percentage in integer lamports, so prizes always add up to exactly the pool. Tied players split the combined prize of the places they occupy.
- **Past periods** are stored as final snapshots so results don't change later.
- **Databases:** `prisma/schema.prisma` (SQLite) is the source of truth. `prisma/postgres/schema.prisma` is generated from it (`npm run db:sync-schema`), with migrations in `prisma/postgres/migrations`. `scripts/prisma.mjs` picks the right schema from `DATABASE_URL`.
- Usernames are partly masked (`Ze****an`) by default.

## Project layout

```
prisma/            SQLite schema, seed; postgres/ = generated schema + migrations
scripts/           Prisma wrapper, start/verify/lighthouse/brand scripts
src/app/           pages: / (leaderboard), /history, /rules, /admin, /api/cron
src/components/    UI pieces (podium, table, countdown, ...)
src/lib/           ranking, payouts, periods, auth, providers, data access
docker/            container entrypoint
docs/              reference notes
```
