# Stage 4 Plan: polish, Postgres, deployment

Project: ZeeDude SolPump wager leaderboard (`D:\zee`). Stages 1–3 are committed on `main`: public UI, admin panel, data providers, cron refresh, fallback (`git log`: eb2eeb9, 6bbcc40, 69ceba2, ebd267f).

Stack (verified in `package.json`): Next.js 16.4.2 (App Router, `cacheComponents: true`, `partialPrefetching: true`), React 19.3, Tailwind 4, Prisma 6.19.3 on SQLite (`prisma/schema.prisma`), zod 3, vitest 5.

## Goal

Make the site production-ready on **Vercel + hosted Postgres** and on **Docker + Postgres**, while local development keeps working on SQLite with zero setup. Also finish the polish the original brief asked for: Open Graph image, SEO files, error pages, security headers, Lighthouse targets.

## Acceptance criteria

1. **Local dev works from a fresh clone, admin login included.** `cp .env.example .env && npm install && npm run admin:password -- "<pw>" && npm run dev` shows the seeded leaderboard on SQLite, and `/admin/login` accepts that password.
   - This needs a fix: `scripts/set-admin-password.ts` currently keeps any existing `SESSION_SECRET` line, including the empty `SESSION_SECRET=""` from `.env.example`. `src/lib/auth.ts` then rejects that value, so login stays disabled.
   - The fix: generate a new secret when the key is missing, empty, or shorter than 32 characters, and keep a valid existing secret.
   - Verified by running the steps above in a temp copy of the repo (`git clone D:\zee <tmp>`). `isAuthConfigured()` must be true there, and a login must succeed through the UI.
2. **One schema, two providers.** `prisma/schema.prisma` stays the single source of truth (SQLite). A generated `prisma/postgres/schema.prisma` differs only in the datasource block. A unit test fails if the generated file is out of date.
3. **Postgres migrations.** `prisma/postgres/migrations/0001_init/migration.sql` is committed and was generated with `prisma migrate diff --from-empty --to-schema-datamodel prisma/postgres/schema.prisma --script`. `migrate deploy` applies it cleanly to an empty Postgres.
4. **Provider is chosen from `DATABASE_URL`.** `scripts/prisma.mjs` wraps the Prisma CLI. If `DATABASE_URL` starts with `postgres://` or `postgresql://`, it passes `--schema prisma/postgres/schema.prisma`; otherwise it uses the default SQLite schema. Every npm script that calls Prisma (`postinstall`, `build`, `db:*`, `predev`) goes through the wrapper. The app code doesn't change: `@prisma/client` is generated from whichever schema matched.
   - *(Revised after inspections 1 and 2: R1 there, then R1–R3 here.)* Every script that talks to the database loads the **full** environment with Next.js's own loader (`@next/env` `loadEnvConfig`, via `scripts/project-env.mjs`) before doing anything: `prisma.mjs`, `db-deploy.mjs`, `ensure-dev-db.ts`, `seed.ts`, `start-standalone.mjs`.
     - This gives the same file precedence as the app, `${VAR}` expansion, and real environment variables winning.
     - Production order (`build` and `db:deploy` pass `--env-mode=production`): `.env.production.local` > `.env.local` > `.env.production` > `.env`.
     - Development order: the same with `.development`.
   - The schema choice, Prisma CLI subprocesses (`DATABASE_URL` *and* `DIRECT_URL`), in-process Prisma clients, and the app therefore all see one configuration.
   - Scripts that construct a PrismaClient (`ensure-dev-db.ts`, `seed.ts`) load the env through the side-effect import `scripts/load-env.mjs` placed **before** `@prisma/client`. Importing `@prisma/client` loads `.env` by itself, which would otherwise pre-empt `.env.local`. `@next/env` is loaded with `createRequire` so it works under both Node and `tsx`.
   - `node scripts/prisma.mjs which-schema` prints the selected schema; tests drive it.
5. **Production build path.**
   - `npm run build` = generate (via wrapper) → `next build`. It never touches the database.
   - A separate `npm run db:deploy` runs `migrate deploy` for Postgres, or `db push` for SQLite.
   - On Vercel, the build command is `npm run db:deploy && npm run build`, documented and set in `vercel.json`.
6. **Destructive scripts are guarded.**
   - `db:seed` wipes data, so it refuses to run when the URL is Postgres or `NODE_ENV=production`, unless `--force-wipe` is given.
   - `predev` (`ensure-dev-db.ts`) only runs `db push` and seeding for SQLite URLs; for Postgres it prints a hint and does nothing.
   - *(Revised after inspection 3, R2.)* `predev` first runs `node scripts/prisma.mjs generate`, so the client always matches the development schema, e.g. after a Postgres production build. Generation is skipped when the client already matches. The Docker `deps` stage copies every local module the `postinstall` wrapper imports (`prisma.mjs`, `prisma-schema.mjs`, `project-env.mjs`) (R1).
7. **Real Postgres proof without Docker.** `npm run verify:postgres` starts a throwaway Postgres (devDependency `embedded-postgres`, pinned) in a temp dir on a random port, then:
   - runs the wrapper's generate + `migrate deploy` + seed (with `--force-wipe`) against it;
   - runs the Next.js production build, assembles the standalone layout (criterion 8), and starts `node .next/standalone/server.js` on a free port;
   - runs the concurrency checks from criterion 17 against this Postgres;
   - checks that `/`, `/history`, `/rules` return 200 with seeded content, and that `/api/cron/refresh` returns 401 without auth and 200 `ok:true` with auth;
   - stops and deletes everything, then regenerates the SQLite client so the dev setup is left as it was. *(Revised after inspection 1, finding R4.)* It waits for the server process to actually exit before regenerating, since on Windows the server holds Prisma's engine open. A failed regeneration counts as a verifier failure.

   It exits non-zero on any failure.
8. **Docker.**
   - `next.config.ts` gets `output: "standalone"`.
   - A multi-stage `Dockerfile` on `node:22-bookworm-slim` (openssl installed) builds with the Postgres schema. The runtime image contains:
     - `.next/standalone/` as the app root;
     - `public/` copied to `./public`, and `.next/static/` copied to `./.next/static` beside `server.js` (standalone output doesn't copy these, per `node_modules/next/dist/docs/.../output.md`);
     - the Prisma CLI and `prisma/postgres`.
   - Its entrypoint runs `migrate deploy`, then `node server.js`.
   - `npm start` changes from `next start` (which doesn't support standalone output) to `node scripts/start-standalone.mjs`. That script copies `public/` and `.next/static/` into `.next/standalone/` and runs its `server.js`. Docker and `verify:postgres` use the same layout.
   - The same copy steps are done locally by `verify:postgres` (criterion 7) when it starts the standalone server. So the layout is proven there by HTTP checks: a JS chunk under `/_next/static/`, `/brand/zeedude-logo.webp`, and `/opengraph-image` must all return 200.
   - `docker-compose.yml` runs `app` + `postgres:17` (named volume, healthcheck) + a `cron` sidecar (`curlimages/curl`) that calls `/api/cron/refresh` every 10 minutes with the bearer secret.
   - *(Revised after inspection 1, finding R2.)* Compose passes the database to `app` as parts (`POSTGRES_HOST/USER/DB/PASSWORD`), not as a URL. The entrypoint builds `DATABASE_URL` with the user, password and database name percent-encoded, so any password characters are safe. An explicit `DATABASE_URL` (for an external database) takes precedence.
   - *(Revised after inspection 2, R4.)* Compose forwards optional `DATABASE_URL`/`DIRECT_URL` to `app`, and `POSTGRES_PASSWORD` is no longer a compose-level requirement. The documented external-database flow is: set the URLs, leave the password empty, and run `docker compose --env-file .env.docker up -d --build --no-deps app cron`.
   - `.dockerignore` excludes `.env*`, `node_modules`, `.next`, `prisma/*.db`.
9. **Open Graph and icons.**
   - `src/app/opengraph-image.tsx` (and a `twitter-image` re-export) renders a static 1200×630 image with `next/og`: banner background, dark overlay, "SolPump Wager Leaderboard", and "Code ZEEDUDE".
   - WebP isn't supported by the OG renderer, so a one-off script (`scripts/brand-assets.mjs`, uses `sharp`, already a Next dependency) creates committed PNG/JPEG copies: `public/brand/og-banner.jpg`, `src/app/icon.png` (64px), `src/app/apple-icon.png` (180px).
   - The `icons` metadata entry pointing at the WebP logo is removed in favour of the file conventions.
10. **SEO files.** `src/app/robots.ts` allows `/` and disallows `/admin` and `/api`. `src/app/sitemap.ts` lists `/`, `/history`, `/rules`. Both use `NEXT_PUBLIC_SITE_URL`.
11. **Error pages.** Styled `src/app/not-found.tsx`, `src/app/error.tsx` (client; "Try again" button) and `src/app/global-error.tsx`, in the brand look, with links back to the leaderboard.
12. **Security headers** via `next.config.ts` `headers()` on all routes:
    - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Frame-Options: DENY`, and `Content-Security-Policy: frame-ancestors 'none'` (frame-ancestors only).
    - `Strict-Transport-Security: max-age=63072000; includeSubDomains` only when `NODE_ENV=production`.
    - A full script CSP is a non-goal (see below).
13. **Login rate limiting.**
    - **IP source.** `clientIp()` in `src/lib/auth.ts` trusts `x-forwarded-for`/`x-real-ip` only when `TRUST_PROXY_HEADERS=true`, and always trusts `x-vercel-forwarded-for` when `VERCEL=1`. Otherwise it uses the bucket `"direct"`, so the per-IP and global limits both still apply and a client can't dodge the limiter by spoofing headers. There's a unit test for the header selection (extract a pure `pickClientIp(headers, env)`).
    - **Concurrency.** Today, `login()` counts failures, runs scrypt, and only then inserts the attempt, so N parallel requests all see the old count and all get checked.
    - **New flow, reserve then count.** `reserveLoginAttempt(db, ip, now)` in `src/lib/login-limiter.ts`:
      1. *Inserts* a `LoginAttempt` row first (`success: false`), before any check.
      2. Counts failed attempts in the window *including* its own row: per IP, and globally.
      3. Rejects if either count is over the limit (`> MAX`).

      Each request's insert is committed before its own count, so concurrent requests see each other's rows. The worst case is rejecting slightly too many requests, never letting too many through.
    - Only reserved, allowed requests run scrypt. On success the row is updated to `success: true`.
    - *(Revised after inspection 1, finding R3.)* A client that is already over a limit is rejected *before* anything is written, so a sustained attack can't grow the `LoginAttempt` table without bound. The lock lasts until its recorded failures leave the 15-minute window. Rows older than 24 hours are pruned on every login attempt, including rejected ones. A rejection that races past that pre-check is still recorded, so the only effect of the race is over-rejecting.
    - Proof is the concurrency check in criterion 17 (40 parallel reservations from one IP → at most 5 allowed), not just the header unit test.
14. **Lighthouse.** Against the standalone server (`npm start`, see criterion 8) on the SQLite build with seed data, Lighthouse (pinned CLI, headless Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`) scores:
    - mobile: performance ≥ 90, accessibility ≥ 95, best practices ≥ 95, SEO ≥ 95;
    - desktop: performance ≥ 95, same for the other three.

    It runs on `/`, `/history` and `/rules`. JSON reports are saved outside the repo; failures are fixed or explained.
15. **Docs.** The README gets "Deploying to Vercel", "Deploying with Docker", "Environment variables" (a full table), "Backups" (pg_dump note) and "Production checklist". `.env.example` gets `DIRECT_URL`, `TRUST_PROXY_HEADERS` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (needed for multiple instances).
17. **Admin writes are atomic.** Today several admin operations check state, then write in a separate step. These are the races:
    - `ensureCurrentPeriod` and period create/update: check for overlap, then write. Two runs could create duplicate periods.
    - `finalizePeriod`: reads `finalizedAt` and standings before its transaction. A double submit can recreate payouts and delete ones already marked paid.
    - `reopenPeriod` and `deletePeriodAction`: count paid payouts before deleting, so a payment marked in between gets erased.
    - Entry save/delete/import: `assertEditable` runs outside the write, so an edit can land after finalization.

    **Fix:** `src/lib/tx.ts` adds `serializable(db, fn)`. It runs `db.$transaction(fn, { isolationLevel: Serializable, maxWait, timeout })` and retries up to 5 times with jitter on serialization conflicts (Prisma `P2034`, plus SQLite busy errors).

    Every one of these operations reads its state *inside* that transaction and writes there too:
    - overlap check + create/update for periods, including `ensureCurrentPeriod`;
    - the `finalizedAt` check + standings + payouts + final snapshot + period update for finalize. It also starts with a compare-and-set `updateMany({ where: { id, finalizedAt: null } })`, and if that touches 0 rows the operation is rejected before any payout changes;
    - the paid check + deletes for reopen and delete;
    - for mark paid/unpaid: the payout's period must still be finalized;
    - `assertEditable` + the write for entry save/delete/import (`saveEntries` takes the transaction client).

    SQLite serializes writers anyway. Postgres `Serializable` (SSI) detects the predicate conflicts.

    **Proof:** `scripts/verify-concurrency.ts` is run by `npm run verify:concurrency` against a temp SQLite file, and by `verify:postgres` against Postgres. It uses `node --conditions=react-server --import tsx` so `server-only` imports resolve. Each scenario is repeated 5 times and must hold:
    - 10 parallel `ensureCurrentPeriod` → exactly 1 period for the week;
    - 10 parallel finalizations → exactly 1 succeeds, payout rows = number of winners, and 1 final snapshot;
    - mark-paid racing reopen → afterwards, either the period is open and the payout never committed as paid, or the payout is paid and the period is still finalized. A paid payout is never deleted;
    - 40 parallel login reservations from one IP → at most 5 allowed; then 20 more attempts while locked write no new rows (R3).
18. **Checks stay green.** `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` (SQLite) all pass. One commit per logical step on `main`, with the Co-Authored-By line.

## Approach and key decisions

- **Why a generated Postgres schema instead of switching dev to Postgres.** The brief asks for SQLite locally and Postgres in production. Prisma's `provider` must be a literal, so one checked-in base schema plus a generated variant is the smallest change. The existing schema already avoids provider-specific types: Float, String-JSON, DateTime, no enums.
- **Connection pooling.** The Postgres datasource declares `directUrl = env("DIRECT_URL")`, which serverless poolers (Neon, Supabase, Vercel Postgres) need for migrations. The docs say to set `DIRECT_URL` equal to `DATABASE_URL` when there is no pooler. Trade-off: one extra required env var on Postgres.
- **Migrations run in a separate step, not in `build`.** This keeps preview builds and CI from mutating databases. Vercel's build command runs `db:deploy` explicitly, and Docker runs it at container start.
- **`verify:postgres` uses `embedded-postgres`.** Docker and Postgres aren't installed on this machine (checked: `docker` not found, no `psql`/`pg_ctl`). An embedded binary gives a real Postgres proof without asking the user for credentials. It's a devDependency only.
- **Static OG image.** A dynamic one showing the live prize pool would need the database at build time or a per-request render. The prize pool changes rarely, so static is enough.
- **Fallback cache on serverless.** It stays per-instance (`os.tmpdir()`). The README states the limitation; no extra infrastructure.

## Non-goals

- A full script Content-Security-Policy with nonces. In Next 16 that forces every page to render dynamically and conflicts with Partial Prerendering. Only `frame-ancestors` is set.
- Real-time updates (websockets) or a CDN cache purge beyond `revalidateTag`.
- Finishing `SolpumpApiProvider`. It stays a stub until official API docs exist.
- Multi-admin accounts or OAuth.
- CI workflow files. The repo has no remote yet; the README documents the commands instead.

## Assumptions (with sources)

- Next 16 file conventions `opengraph-image`, `robots`, `sitemap`, `icon` and `apple-icon` are read from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/` before writing them.
- `output: "standalone"` works with `cacheComponents` (to be confirmed in the docs under `03-api-reference/05-config/01-next-config-js/output.md`).
- Prisma 6 supports `directUrl` for postgresql and `migrate diff --from-empty --to-schema-datamodel` (Prisma 6 CLI docs).
- `sharp` ships with `next` (`node_modules/sharp`), so it's usable from a script.

## Remaining risks

- The Docker image can't be built or run on this machine (no Docker). The standalone runtime layout is exercised by `verify:postgres`, but the Dockerfile's build stages are checked only by review. The README marks `docker compose up` as unverified until the user runs it.
- `embedded-postgres` downloads platform binaries through npm optional dependencies. If that fails on Windows, the fallback is to ask the user for a disposable Neon database URL and run the same `verify:postgres` steps against it (`VERIFY_DATABASE_URL`).
- Lighthouse scores vary between runs. Each page is run 3 times and the median is taken.
- SQLite under the standalone server: Prisma resolves `file:./dev.db` relative to the schema location, and that can change once `server.js` runs from `.next/standalone`. `start-standalone.mjs` therefore turns a relative SQLite URL into an absolute path (`prisma/dev.db` in the project root) before starting. The Lighthouse run proves it works.
- Serializable transactions can abort under contention. The retry helper bounds this (5 attempts with jitter). If retries run out, the admin sees a "Busy, try again" message instead of a partial write.

## Verification (proof commands)

```bash
npm test                       # all unit tests, incl. new schema-sync, pickClientIp and set-admin-password secret tests
npm run lint
npx tsc --noEmit
npm run build                  # SQLite path
npm run verify:concurrency     # race scenarios from criterion 17 against a temp SQLite DB
npm run verify:postgres        # real Postgres: migrate, seed, concurrency checks, build, standalone start, HTTP + asset checks
node scripts/lighthouse.mjs    # 3 runs × 3 pages × mobile/desktop against npm start, prints medians, exits non-zero below targets
```

Manual checks (browser pane, desktop and 375px mobile):
- the OG image at `/opengraph-image`;
- the 404 page;
- an error boundary, triggered with a temporary `throw` that is then removed;
- response headers via `curl -I` on `/` and `/admin/login`;
- `/robots.txt` and `/sitemap.xml`;
- `npm run dev` still works on SQLite afterwards (the `verify:postgres` cleanup restores the SQLite client).

Old/new comparison: run `curl` on `/`, `/history` and `/rules` with the SQLite build before and after the stage. They must return the same status and the same leaderboard rows; only headers and metadata may change.
