# Reference Notes

Studied on 2026-10-21. These notes record layout and UX patterns only. No branding, copy, logos, or code from either site will be reused.

- **A** = reaper-rewards.com/solpump (SolPump-specific, SOL-denominated)
- **B** = appierewards.com/leaderboard (Roobet, USD-denominated, multi-casino)

---

## 1. Page layout and sections

| | A | B |
|---|---|---|
| Nav | Top bar: "Back home" link + pill buttons to other casino boards and a profile page. Floating vertical social rail on the left edge (Kick, X, Discord, casino links). | Persistent left icon sidebar on desktop (Home, Leaderboard, VIP Rewards, Challenges, Milestones, Bonus Hunts); collapses to a hamburger on mobile. |
| Hero | Huge centered two-line title over full-bleed illustrated art. One-sentence pitch with the prize pool highlighted in green, then period/reset rules in smaller text. | Small eyebrow label ("bi-weekly competition"), a casino switcher (tabs for each casino), a big condensed headline that *is* the prize ("$10,000 LEADERBOARD"), one line with the code inline, then a "Play" CTA and a "Rules" button. |
| Stats | Row of 4 glassy stat cards: Code / Time left / Players shown / Prize pool. Stacks to 1 column on mobile. | No stat cards; the countdown is its own section below the podium. |
| Body order | Stats → period dates + "last synced" line → full table (ranks 1–20) → prize distribution grid → CTA buttons. | Hero → podium (top 3) → countdown → "Rankings" table (4+) with "Show more" → footer. |

## 2. Leaderboard columns and top 3

- **A**: Single table for everyone. Columns: Rank · User (letter avatar + masked name) · Weekly wagered · Current prize. Top 3 are just rows with gold/silver/bronze-tinted borders and a coloured rank circle. Shows 20 rows; ranks 11+ show a prize of 0.
- **B**: Dedicated **podium** of 3 cards, ordered 2-1-3 with #1 taller and centred. Each card has an avatar, rank badge, masked name, "Wagered" label + amount, and the prize in a pill at the bottom. Each place has its own accent colour (purple / teal / amber). Rankings table below starts at #4: Player · Wagered · Prize. Prize shown as a pill. "Show more" expands the list.
- **Masking**: A shows first 3 chars + `*` for the remaining length (leaks name length). B shows first 3 chars + a fixed `***` (doesn't leak length; better for privacy).

**Take:** B's podium + table split, with fixed-length masking. A's "current prize" column so every row shows what it would win right now.

## 3. Prize pool and payout layout

- **A**: "Prize Distribution" grid of 10 cards: `#n`, amount, and "% of pool". Clear and honest about the split. Split was 50 / 25 / 10 / 5 / 3 / 2 / 2 / 1.5 / 1 / 0.5 %.
- **B**: No separate breakdown; prizes appear only per row. Pool is in the headline.

**Take:** Headline the pool total (B) and include a full breakdown section with amount + % (A).

## 4. Countdown timer

- **A**: Compact text "4d 6h 58m" in a stat card, no seconds. Shows exact period window in Central Time below it.
- **B**: Large segmented clock (Days / Hours / Mins / Secs) ticking every second, with the UTC date range above it. Also puts the time left in the browser tab title ("12d 20h left · …"). Nice touch.

**Take:** Segmented ticking countdown with the period range, plus the time left in the tab title. Show times in UTC and the viewer's local time.

## 5. Referral code / link presentation

- **A**: Code is a stat card ("CODE: Reaper"), plus a "Join Solpump" button at the bottom. No copy button.
- **B**: Code is inline in the subheading, highlighted in an accent colour; a "Play on …" button with an external-link icon sits in the hero.

**Take:** Neither has a copy button or explicit steps. We'll do better with a dedicated "How to join" card: code + copy button, signup button, three numbered steps.

## 6. Previous leaderboard / history

- **A**: None visible on the page.
- **B**: "Previous Leaderboard" button in the Rankings header opens a **modal** with the last period's date range, its own podium and full results. Only the immediately previous period; no selector.

**Take:** A dedicated `/history` page with a period selector (all past periods), each showing final podium, table, and paid status.

## 7. Data freshness

- **A** shows "Last synced: <time> CT • Manual Solpump sync required. Just wagered? Your total may appear after the next import." This confirms SolPump boards are commonly maintained by manual import, which matches our plan. Honest freshness messaging builds trust.
- **B** doesn't show a sync time.

**Take:** Always show "Last updated", plus a "may be delayed" note.

## 8. Rules

- **A**: Rules are inline sentences in the hero (who's paid, when it resets).
- **B**: "Rules" button opens a modal: how wagers count, game-weight multipliers table (e.g. high-RTP games count less), abuse forfeits prize.

**Take:** Full `/rules` page (FAQ accordion) plus a short summary near the table.

## 9. Visual style

| | A | B |
|---|---|---|
| Background | Near-black `#0a0a0a` with a busy illustrated fantasy hero image. | Dark slate `#16171d`, purple sky/cloud hero that fades into the page. |
| Accents | Neon: purple borders, green for money, cyan, amber for prize pool. Each stat card has its own glow colour. | Muted per-place colours (purple, teal, amber); teal for interactive elements. |
| Type | Heavy sans (Arial/Helvetica in practice) for big titles; Geist loaded. | Bebas Neue (condensed display) for headings, IBM Plex Sans / DM Sans for body. Strong hierarchy. |
| Motion | Mostly static; content below the fold appears to render late on scroll. | Podium cards fade/slide in on load; countdown ticks. |
| Mobile | Stat cards stack into a single tall column (long scroll before the table). | Sidebar → hamburger; hero stacks; buttons go side-by-side full-width. Podium appears below the fold. |

**Takeaways for Zee Dude**
- Condensed display font for numbers/headlines + a clean sans for body (B's hierarchy is stronger).
- Dark base with a gradient hero that fades into the page (B) rather than a busy illustration (A, hurts readability and performance).
- Per-place accent colours on the podium; green for money values.
- On mobile, keep the podium and countdown near the top. A's tall stack of stat cards pushes the leaderboard too far down; use a 2×2 grid instead.
- Respect `prefers-reduced-motion` (neither site visibly does).

## What we will do differently (original to Zee Dude)

- Own palette: deep navy/ink base with a Zee Dude signature gradient (Solana-style purple → teal → green), not neon-on-black or purple clouds.
- Copyable referral code + 3-step join card.
- Full history page with a period selector.
- Paid / unpaid badges on past winners for transparency.
- Fixed-length masking with an admin unmask toggle.
- Accessibility: semantic table, keyboard focus states, reduced motion, AA contrast.
