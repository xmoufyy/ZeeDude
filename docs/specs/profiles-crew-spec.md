# Spec: player profiles, Dude Crew page, and follow-up changes

Inspection contract for work after snapshot `dd0077a` (the last Codex-inspected state). This spec records what the user asked for and decided; it was not plan-reviewed before building.

## 1. Inspection-4 fixes (commit `8d9ed5f`)

- `docker-compose.yml` forwards `SOLPUMP_API_URL`, `SOLPUMP_API_KEY`, `AUTO_CREATE_PERIODS` (default `true`) and `DATA_STALE_AFTER_MINUTES` (default `1440`) to `app`. They're listed in `.env.docker.example`.
- `absoluteSqliteUrl` pins every relative SQLite path to `prisma/` (`file:dev.db`, `file:./x`, `file:../x`) and keeps `?params`. Absolute paths and non-file URLs pass through unchanged.
- `readEnvValue` uses dotenv rules (`util.parseEnv`), so `SESSION_SECRET="" # comment` counts as empty and `admin:password` replaces it.

## 2. My Profile (user request; decisions made by the user)

User request: a "My Profile" tab with payout wallet and socials, plus a toggle for whether their name is hidden.

The user chose:
- **Sign-in with a Solana wallet.** The player signs a message; there's no transaction. The signed-in wallet is the verified payout wallet.
- **Admin approves SolPump username claims.** A claim stays pending until approved on Admin → Players.
- **Hide toggle = masked vs full name**, per player, overriding the site-wide masking setting. It only takes effect once the claim is approved.

Requirements:
- **Sign-in.**
  - The server issues a one-time message containing domain, wallet, a 16-byte nonce and issued-at time. It stores the exact message with a 5-minute expiry and keeps only the newest nonce per wallet.
  - On finish, the nonce is deleted (single use) *before* the ed25519 signature is verified against the stored message (not a client-supplied one).
  - The wallet must be a base58 32-byte key.
  - Open challenges are capped (1000) against flooding.
  - The session is an httpOnly, SameSite=lax, 7-day signed cookie `zd_player`. It's signed with a key distinct from the admin session key; its `sub` is the wallet.
- **Profile fields.**
  - SolPump username: required in the UI, 1–64 characters, control characters stripped.
  - Display name: up to 40 characters.
  - Discord: 2–32 characters of `[a-z0-9_.]`, lowercased, `@` stripped.
  - Kick: 3–25 characters of `[A-Za-z0-9_]`.
  - X: 1–15 characters of `[A-Za-z0-9_]`, `@` stripped.
  - `hideName` (default true).
- **Claims.**
  - Lowercased `solpumpKey` is unique, so a name can't be claimed twice.
  - Changing the name sets the claim to pending (or none if cleared).
  - The claim check and the write run in one serializable transaction. A P2002 unique violation maps to "already claimed".
  - Admin actions: approve; reject (frees the name: key set to null, status rejected); unverify (back to pending).
- **Public boards.** For an approved claim, the player's `hideName` decides masked vs full name. Everyone else follows the site-wide setting. Changes expire the leaderboard cache.
- **Profile page.**
  - Signed out: wallet sign-in (Phantom/Solflare/Backpack injected providers, re-detected for a few seconds).
  - Signed in: stats (rank and wager this week, prizes paid, status), a pending-prize note, the form, and sign out.
- **Admin.**
  - Players page (pending first; shows whether the name appears in imported wager data; socials).
  - Dashboard banner for pending claims.
  - Payouts on the period page show the winner's verified wallet.
- **Data.** `Player` and `WalletNonce` models; Postgres migration `0002_player_profiles`. `verify:postgres` runs a Prisma drift check against a shadow database. The seed clears profiles.

## 3. Dude Crew page (user request)

User request: a tab with a fun name that encourages people to join the Discord. The user chose "The Dude Crew".

- `/crew` contains: hero, Join Discord button (`NEXT_PUBLIC_DISCORD_URL`; shows "Discord invite coming soon" if unset), X and Kick buttons if set, 6 perk cards, and 3 getting-started steps. All copy is original.
- Nav adds Dude Crew and My Profile. On phones (<md) the tabs collapse behind a Menu button with no horizontal overflow at 375px.

## 4. Remove 18+ and responsible-gambling content (explicit user instruction)

- Remove the footer 18+ badge and helpline line, the Rules page "Play Responsibly" section and helplines, the Dude Crew 18+ footnote, and the age clause in the Rules eligibility answer.
- **This deliberately supersedes** the original brief's 18+ / responsible-gambling requirement. Don't flag the absence as a defect.
- `<html>` gets `suppressHydrationWarning`, because browser extensions (LanguageTool) inject attributes there before hydration.

## 5. Copy wallet in "Payouts to send" (user request)

- Each unpaid prize on the admin dashboard shows the winner's verified wallet (from an approved profile, matched case-insensitively) with a **Copy wallet** button, or "No verified wallet yet".

## Verification already run by the host

- `npm test` 104/104; tsc and eslint clean; `verify:concurrency` 4/4; `verify:postgres` 14/14 with the drift check passing.
- Browser: simulated Ed25519 wallet sign-in, profile save, toggle persistence, the masking behaviour before and after approval, and the profile stats.
- A real-wallet sign-in and save also appear in the user's dev-server log.
- Dashboard copy-wallet rendering was checked through the server-rendered page.

## 6. Revisions after inspection 5 (supersede the matching lines above)

- **Claim review is bound to the reviewed name.** `reviewClaim(playerId, decision, reviewedKey)` refuses the decision unless, inside the serializable transaction, the player's current `solpumpKey` equals `reviewedKey` and the status is the one that decision applies to: approve/reject need `pending`, unverify needs `approved`. The Players page buttons pass the key they displayed.
- **Wallet challenges are atomic.** Pruning expired challenges, removing the wallet's previous challenge, the cap check (1000) and creation run in one serializable transaction (`src/lib/wallet-challenge.ts`). `WalletNonce.wallet` is `@unique`; Postgres migration `0003_unique_wallet_nonce` clears the short-lived challenges and replaces the index with a unique one. A concurrent same-wallet start that loses gets "Another sign-in for this wallet is in progress".
- **Fallback copies fail closed on privacy.** Leaderboards kept as outage fallbacks (memory and disk) have every name masked, and served fallbacks are masked again on the way out, which also covers copies saved by older versions. Live pages are unaffected.
- Proofs added: `verify:concurrency` covers stale or repeated claim reviews, 10 parallel same-wallet starts (exactly 1 challenge) and parallel starts at the cap (never above 1000); unit tests cover the masked fallback.
- `verify:postgres` runs its steps with async `spawn` (not `spawnSync`), because the embedded Postgres's log pipe is drained by the verifier's event loop. Each step has a 20-minute limit, and each `verify:concurrency` run a 60-second limit, so a stall fails instead of hanging.
