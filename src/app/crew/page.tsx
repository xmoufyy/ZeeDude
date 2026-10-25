import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Join the Dude Crew",
  description: "The ZeeDude Discord: race updates, giveaways, win reactions and bad-beat stories with the crew.",
};

const PERKS = [
  { icon: "👑", title: "Race updates", body: "Leaderboard shout-outs and a heads-up before every Sunday 5 PM reset." },
  { icon: "🎁", title: "Giveaways & drops", body: "SOL giveaways and surprise drops for members who show up." },
  { icon: "🎰", title: "Win reactions", body: "Post your biggest hits and get the hype you deserve." },
  { icon: "🎲", title: "Bad beat stories", body: "Every degen needs a place to vent. The crew has been there." },
  { icon: "⚡", title: "First to know", body: "New races, prize changes and promos land in Discord first." },
  { icon: "🛡️", title: "Prize help", body: "Questions about your payout or profile? The mods have your back." },
];

const discord = site.socials.find((s) => s.name === "Discord")?.href;
const others = site.socials.filter((s) => s.name !== "Discord");

export default function CrewPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-20 px-4 pt-10 sm:pt-16">
      <section className="relative space-y-6 text-center" aria-labelledby="crew-heading">
        <div className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-64 max-w-xl rounded-full bg-violet/30 blur-3xl" aria-hidden="true" />
        <div className="panel panel-feature relative mb-10 overflow-hidden p-1.5 shadow-[0_24px_60px_-30px] shadow-magenta">
          <Image
            src="/brand/dude-munity-banner.webp"
            alt="Dude-munity: the crypto casino community. ZeeDude on a golden throne under stage lights. Real degens, real people. Use code ZEEDUDE."
            width={2000}
            height={750}
            sizes="(min-width: 1024px) 992px, 100vw"
            className="h-auto w-full rounded-[1rem]"
            priority
          />
        </div>
        <p className="eyebrow relative tracking-[0.3em]">ZeeDude × Community</p>
        <h1 id="crew-heading" className="relative font-display text-5xl leading-[1.05] sm:text-7xl">
          Join the <span className="text-gold-gradient">Dude Crew</span>{" "}
          <span aria-hidden="true">👑</span>
        </h1>
        <p className="relative text-lg font-semibold text-gold-light sm:text-xl">Real degens. Real people. Real rewards.</p>
        <p className="relative mx-auto max-w-2xl text-muted">
          The crew hangs out on Discord. That&apos;s where race updates, giveaway drops, big-win reactions and bad-beat
          stories all happen. Wins, losses and laughs, together.
        </p>
        <div className="relative flex flex-wrap justify-center gap-3">
          {discord ? (
            <a
              href={discord}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-brand rounded-2xl px-7 py-4 text-lg"
            >
              Join the Discord <span aria-hidden="true">→</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-2xl border border-line px-7 py-4 text-lg font-bold text-muted">
              Discord invite coming soon
            </span>
          )}
          {others.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn rounded-2xl px-6 py-4 text-base hover:border-gold/50 hover:text-gold"
            >
              {s.name === "X" ? "Follow ZeeDude on X" : `Watch on ${s.name}`}
            </a>
          ))}
        </div>
      </section>

      <section className="space-y-8" aria-labelledby="why-heading">
        <div className="text-center">
          <p className="eyebrow tracking-[0.3em]">Perks</p>
          <h2 id="why-heading" className="font-display text-3xl sm:text-4xl">
            Why join?
          </h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERKS.map((perk) => (
            <li key={perk.title} className="panel p-6 transition hover:-translate-y-0.5 hover:border-gold/40 motion-reduce:hover:translate-y-0">
              <span className="text-3xl" aria-hidden="true">
                {perk.icon}
              </span>
              <h3 className="mt-3 font-display text-lg">{perk.title}</h3>
              <p className="mt-1 text-sm text-muted">{perk.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-8" aria-labelledby="steps-heading">
        <div className="text-center">
          <p className="eyebrow tracking-[0.3em]">Three steps</p>
          <h2 id="steps-heading" className="font-display text-3xl sm:text-4xl">
            How to get started
          </h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          <li className="panel p-6">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet to-magenta font-display text-white" aria-hidden="true">
              1
            </span>
            <h3 className="mt-3 font-semibold">Hop in the Discord</h3>
            <p className="mt-1 text-sm text-muted">Say hi, grab your roles, and turn on race notifications.</p>
          </li>
          <li className="panel p-6">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet to-magenta font-display text-white" aria-hidden="true">
              2
            </span>
            <h3 className="mt-3 font-semibold">Use code {site.referralCode}</h3>
            <p className="mt-1 text-sm text-muted">
              Sign up on{" "}
              <a href={site.referralUrl} target="_blank" rel="noopener noreferrer sponsored" className="text-cyan hover:underline">
                SolPump
              </a>{" "}
              with our code to enter the weekly race.
            </p>
          </li>
          <li className="panel p-6">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-violet to-magenta font-display text-white" aria-hidden="true">
              3
            </span>
            <h3 className="mt-3 font-semibold">Link your profile</h3>
            <p className="mt-1 text-sm text-muted">
              Connect your wallet in{" "}
              <Link href="/profile" className="text-cyan hover:underline">
                My Profile
              </Link>{" "}
              so we know where to send your prizes.
            </p>
          </li>
        </ol>
      </section>
    </div>
  );
}
