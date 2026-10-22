"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/periods", label: "Periods" },
  { href: "/admin/affiliate", label: "SolPump import" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/users", label: "Excluded users" },
];

// usePathname() needs a Suspense boundary on dynamic routes; the fallback is
// the same links without the active highlight.
export function AdminNav() {
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
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {LINKS.map(({ href, label }) => {
        const active = href === "/admin" ? pathname === href : !!pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
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
