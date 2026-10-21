"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/history", label: "Past Winners" },
  { href: "/rules", label: "Rules" },
];

// usePathname() needs a Suspense boundary on dynamic routes; the fallback is
// the same links without the active highlight.
export function NavLinks() {
  return (
    <Suspense fallback={<Links />}>
      <ActiveLinks />
    </Suspense>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Main" className="flex flex-1 justify-end gap-1 md:flex-none md:justify-start md:pl-4">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-white/10 text-gold" : "text-muted hover:bg-white/5 hover:text-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
