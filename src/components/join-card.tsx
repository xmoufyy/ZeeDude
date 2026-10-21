import { site } from "@/lib/site";
import { CopyCode } from "./copy-code";

const STEPS = [
  { title: "Sign up with our code", body: `Create your SolPump account through our link or enter code ${site.referralCode} at signup.` },
  { title: "Wager like normal", body: "Every bet you place on SolPump during the week adds to your total on this board." },
  { title: "Climb and get paid", body: "Finish in a paid spot when the week resets on Sunday at 5 PM ET and we send your prize." },
];

export function JoinCard() {
  return (
    <section
      id="join"
      aria-labelledby="join-heading"
      className="panel relative overflow-hidden border-gold/25 p-5 sm:p-8"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-magenta/20 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-center">
        <div className="space-y-4">
          <h2 id="join-heading" className="font-display text-2xl sm:text-3xl">
            How to <span className="text-gold-gradient">Join</span>
          </h2>
          <p className="text-muted">Use our referral code on SolPump to enter the race automatically.</p>
          <CopyCode code={site.referralCode} />
          <a
            href={site.referralUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-gold to-gold-deep px-6 py-3.5 text-lg font-bold text-ink shadow-[0_8px_30px_-8px] shadow-gold transition hover:brightness-110"
          >
            Sign up on SolPump
            <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
              <path d="M11 3a1 1 0 100 2h2.59l-6.3 6.29a1 1 0 101.42 1.42L15 6.41V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-ink/40 p-4">
              <span
                className="mb-2 grid size-9 place-items-center rounded-full bg-gradient-to-br from-violet to-magenta font-display text-white"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
