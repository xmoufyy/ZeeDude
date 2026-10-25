import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/history", label: "Past Winners" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/crew", label: "Dude Crew" },
  { href: "/rules", label: "Rules & FAQ" },
  { href: "/profile", label: "My Profile" },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-line bg-night/70">
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet/60 to-transparent" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_auto]">
        <div className="space-y-3 text-sm text-muted">
          <p className="flex items-center gap-2.5">
            <Image src="/brand/zeedude-logo.webp" alt="" width={32} height={32} className="size-8 rounded-full ring-1 ring-gold/50" />
            <span className="font-display text-base text-gold-gradient">ZeeDude Rewards</span>
          </p>
          <p className="max-w-2xl">
            ZeeDude Rewards is a community site. It is <strong className="text-text">not affiliated with, endorsed by, or
            operated by SolPump</strong>. Prizes are paid by ZeeDude, not by SolPump.
          </p>
          <p>
            Use code <strong className="font-display tracking-wider text-gold">{site.referralCode}</strong> on SolPump to join the
            weekly race.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-sm md:items-end">
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-4">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded text-muted transition-colors hover:text-text">
                {l.label}
              </Link>
            ))}
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
                    <span className="sr-only"> (opens in a new tab)</span>
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
