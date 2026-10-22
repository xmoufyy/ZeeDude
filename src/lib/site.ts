// Public site settings. Everything here can be overridden with NEXT_PUBLIC_*
// env vars (see .env.example) so nothing brand-specific is hardcoded in pages.

const env = (value: string | undefined, fallback = "") => value?.trim() || fallback;

export const site = {
  name: "ZeeDude Rewards",
  // On Vercel, fall back to the project's production domain so share previews
  // (og:image) never point at localhost when NEXT_PUBLIC_SITE_URL isn't set.
  url: env(
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  referralCode: env(process.env.NEXT_PUBLIC_REFERRAL_CODE, "ZEEDUDE"),
  referralUrl: env(process.env.NEXT_PUBLIC_REFERRAL_URL, "https://solpump.io/a/ZEEDUDE"),
  timeZoneLabel: "Eastern Time",
  socials: [
    { name: "Discord", href: env(process.env.NEXT_PUBLIC_DISCORD_URL) },
    { name: "X", href: env(process.env.NEXT_PUBLIC_X_URL) },
    { name: "Kick", href: env(process.env.NEXT_PUBLIC_KICK_URL) },
  ].filter((s) => s.href),
};
