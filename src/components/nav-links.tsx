"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";

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
  const [shownPath, setShownPath] = useState(pathname);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Any navigation closes the menu, including the browser's back and forward buttons.
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
  }

  // Escape or a tap outside closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const items = (onNavigate?: () => void) =>
    LINKS.map(({ href, label }) => {
      const active = pathname === href;
      return (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`relative rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
            active
              ? "bg-white/10 text-gold shadow-[inset_0_0_0_1px] shadow-gold/25"
              : href === "/profile"
                ? "text-gold-light hover:bg-white/5 hover:text-gold"
                : "text-muted hover:bg-white/5 hover:text-text"
          }`}
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
      {/* Phones: the tabs don't fit in one row, so they live behind a menu button. */}
      <div ref={menuRef} className="ml-auto md:hidden">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="btn px-4"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
          {open ? "Close" : "Menu"}
        </button>
        {open && (
          <div
            id="mobile-nav"
            // Opaque: a backdrop blur can't work inside the already-blurred header, so page text would show through.
            className="absolute inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-night p-4 shadow-2xl shadow-black/70"
          >
            <nav aria-label="Main" className="flex flex-col gap-1 [&>a]:rounded-xl [&>a]:px-4 [&>a]:py-3 [&>a]:text-base">
              {items(() => setOpen(false))}
            </nav>
            <a
              href={site.referralUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="btn btn-primary mt-3 w-full py-3 text-base"
            >
              Join SolPump with code {site.referralCode}
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        )}
      </div>
    </>
  );
}
