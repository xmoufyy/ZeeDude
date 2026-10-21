import Link from "next/link";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-night/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_auto]">
        <div className="space-y-3 text-sm text-muted">
          <p className="font-display text-base text-gold-gradient">ZeeDude Rewards</p>
          <p className="max-w-2xl">
            ZeeDude Rewards is a community site. It is <strong className="text-text">not affiliated with, endorsed by, or
            operated by SolPump</strong>. Prizes are paid by ZeeDude, not by SolPump.
          </p>
          <p className="max-w-2xl">
            <span className="mr-1.5 inline-flex rounded-md border border-magenta/50 px-1.5 py-0.5 text-xs font-bold text-magenta">
              18+
            </span>
            Gambling involves risk. Only wager what you can afford to lose. If gambling stops being fun, get help at{" "}
            <a className="text-cyan underline-offset-2 hover:underline" href="https://www.ncpgambling.org/help-treatment/" target="_blank" rel="noopener noreferrer">
              1-800-GAMBLER
            </a>{" "}
            or{" "}
            <a className="text-cyan underline-offset-2 hover:underline" href="https://www.begambleaware.org/" target="_blank" rel="noopener noreferrer">
              BeGambleAware
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm md:items-end">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/" className="text-muted hover:text-text">Leaderboard</Link>
            <Link href="/history" className="text-muted hover:text-text">Past Winners</Link>
            <Link href="/rules" className="text-muted hover:text-text">Rules &amp; FAQ</Link>
          </nav>
          {site.socials.length > 0 && (
            <ul className="flex gap-2" aria-label="Social links">
              {site.socials.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-full border border-line px-3 py-1.5 text-muted transition hover:border-gold/50 hover:text-gold"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
