"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/history", label: "Past Winners" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/crew", label: "Dude Crew" },
  { href: "/rules", label: "Rules" },
  { href: "/profile", label: "My Profile" },
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
  const [open, setOpen] = useState(false);
  const items = (onNavigate?: () => void) =>
    LINKS.map(({ href, label }) => {
      const active = pathname === href;
      return (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
            active ? "bg-white/10 text-gold" : "text-muted hover:bg-white/5 hover:text-text"
          } ${href === "/profile" && !active ? "text-gold-light" : ""}`}
        >
          {label}
        </Link>
      );
    });

  return (
    <>
      <nav aria-label="Main" className="hidden gap-1 md:flex md:pl-4">
        {items()}
      </nav>
      {/* Phones: five tabs don't fit in one row, so they live behind a menu button. */}
      <div className="ml-auto md:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="btn px-4"
        >
          {open ? "Close" : "Menu"}
        </button>
        {open && (
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="absolute inset-x-0 top-16 flex flex-col gap-1 border-b border-line bg-ink/95 p-4 backdrop-blur-md [&>a]:rounded-xl [&>a]:px-4 [&>a]:py-3 [&>a]:text-base"
          >
            {items(() => setOpen(false))}
          </nav>
        )}
      </div>
    </>
  );
}
