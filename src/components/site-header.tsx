import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="ZeeDude Rewards home">
          <Image
            src="/brand/zeedude-logo.webp"
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full ring-2 ring-gold/60"
            priority
          />
          <span className="hidden font-display text-lg leading-none text-gold-gradient sm:block">ZeeDude</span>
        </Link>
        <NavLinks />
        <a
          href={site.referralUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="ml-auto hidden shrink-0 rounded-full bg-gradient-to-b from-gold to-gold-deep px-4 py-2 text-sm font-bold text-ink shadow-[0_0_20px_-6px] shadow-gold transition hover:brightness-110 md:block"
        >
          Join SolPump
        </a>
      </div>
    </header>
  );
}
