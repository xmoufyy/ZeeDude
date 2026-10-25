import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-full" aria-label="ZeeDude Rewards home">
          <Image
            src="/brand/zeedude-logo.webp"
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full ring-2 ring-gold/60 transition group-hover:ring-gold"
            priority
          />
          <span className="hidden font-display text-lg leading-none text-gold-gradient sm:block">ZeeDude</span>
        </Link>
        <NavLinks />
        <a
          href={site.referralUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="btn btn-primary ml-auto hidden shrink-0 rounded-full px-4 md:inline-flex"
        >
          Join SolPump
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      {/* Gold-to-magenta rim, echoing the logo's lettering. */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" aria-hidden="true">
        <div className="mx-auto h-px max-w-xl bg-gradient-to-r from-transparent via-magenta/60 to-transparent" />
      </div>
    </header>
  );
}
