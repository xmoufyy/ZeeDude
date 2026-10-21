import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Rules & FAQ",
  description: "How the ZeeDude SolPump wager leaderboard works: eligibility, how wagers count, payouts, and responsible gambling.",
};

// DRAFT rules: placeholders until ZeeDude confirms the real terms. Edit freely.
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Who can enter?",
    a: (
      <>
        Anyone 18 or older (or the legal gambling age where you live, if higher) who signs up on SolPump with code{" "}
        <strong className="text-gold">{site.referralCode}</strong> or through our referral link. You must be allowed to use
        SolPump where you live. Accounts that signed up under a different code don&apos;t count.
      </>
    ),
  },
  {
    q: "When does each race run?",
    a: "Every week, from Sunday at 5:00 PM Eastern Time to the next Sunday at 5:00 PM Eastern Time. The countdown on the leaderboard always shows the exact end time.",
  },
  {
    q: "How are wagers counted?",
    a: "Your total is the amount you wager on SolPump during the race window, in SOL, as reported in our SolPump referral data. Only wagers placed between the start and end time count.",
  },
  {
    q: "Why doesn't my total match what I just bet?",
    a: "We import totals from SolPump periodically, not live. If you just wagered, your total will update after the next import. Final standings use the last import after the race ends.",
  },
  {
    q: "What happens if two players tie?",
    a: "Tied players share the same rank and split the combined prizes of the places they occupy equally. For example, two players tied for 2nd split the 2nd and 3rd place prizes.",
  },
  {
    q: "How and when are prizes paid?",
    a: "Prizes are paid in SOL by ZeeDude after the race ends and results are checked, usually within 48 hours. Winners are marked as Paid on the Past Winners page once sent.",
  },
  {
    q: "What can get me disqualified?",
    a: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Using more than one account (alts) or sharing accounts.</li>
        <li>Wagering with a partner to farm volume, or other abuse of bonuses or games.</li>
        <li>Staff and moderator accounts are not eligible.</li>
        <li>Anything SolPump flags as fraud or that breaks SolPump&apos;s terms.</li>
      </ul>
    ),
  },
  {
    q: "Is this run by SolPump?",
    a: "No. ZeeDude Rewards is an independent community promotion. It is not affiliated with, endorsed by, or operated by SolPump. Prizes come from ZeeDude.",
  },
  {
    q: "Can the rules change?",
    a: "ZeeDude may update these rules, change prize amounts for future races, or void results in cases of abuse. Changes never apply to a race that's already finished.",
  },
];

const HELP = [
  { name: "National Problem Gambling Helpline (US)", detail: "Call or text 1-800-GAMBLER", href: "https://www.ncpgambling.org/help-treatment/" },
  { name: "BeGambleAware (UK)", detail: "0808 8020 133, free 24/7", href: "https://www.begambleaware.org/" },
  { name: "Gamblers Anonymous", detail: "Meetings worldwide", href: "https://gamblersanonymous.org/" },
  { name: "Gambling Therapy", detail: "Free global online support", href: "https://www.gamblingtherapy.org/" },
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 pt-8 sm:pt-12">
      <header className="space-y-3">
        <h1 className="font-display text-3xl sm:text-5xl">
          Rules <span className="text-gold-gradient">&amp; FAQ</span>
        </h1>
        <p className="text-muted">Everything you need to know about the weekly SolPump wager race.</p>
      </header>

      <section aria-labelledby="faq-heading" className="space-y-3">
        <h2 id="faq-heading" className="sr-only">Frequently asked questions</h2>
        {FAQ.map((item, i) => (
          <details key={item.q} className="panel group px-5 py-1 open:pb-4" open={i < 2}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold marker:hidden">
              {item.q}
              <span className="text-gold transition group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <div className="text-muted">{item.a}</div>
          </details>
        ))}
      </section>

      <section aria-labelledby="rg-heading" className="panel space-y-4 border-magenta/30 p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-lg border-2 border-magenta px-2 py-0.5 font-display text-magenta">18+</span>
          <h2 id="rg-heading" className="font-display text-xl">Play Responsibly</h2>
        </div>
        <p className="text-muted">
          Gambling should be entertainment, never a way to make money. Set a budget before you play, never chase losses, and
          take breaks. Leaderboards can push you to wager more than you planned. Don&apos;t let them. If gambling is
          causing you or someone close to you harm, free and confidential help is available:
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {HELP.map((h) => (
            <li key={h.name}>
              <a
                href={h.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-line bg-ink/40 p-4 transition hover:border-cyan/50"
              >
                <span className="block font-semibold text-cyan">{h.name}</span>
                <span className="text-sm text-muted">{h.detail}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
