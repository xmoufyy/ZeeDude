"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Notice } from "./notice";

type Props = {
  startsAt: string;
  endsAt: string;
  /** Server time at render, so the first client render matches the HTML. */
  serverNow: number;
  /** The race's results are locked in. */
  finalized?: boolean;
};

const UNITS = [
  { label: "Days", ms: 86_400_000 },
  { label: "Hours", ms: 3_600_000 },
  { label: "Mins", ms: 60_000 },
  { label: "Secs", ms: 1_000 },
];

function split(ms: number) {
  let rest = Math.max(0, ms);
  return UNITS.map((u) => {
    const value = Math.floor(rest / u.ms);
    rest -= value * u.ms;
    return { ...u, value };
  });
}

export function Countdown({ startsAt, endsAt, serverNow, finalized = false }: Props) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const notStarted = now < start;
  const ended = now >= end;

  // When the race starts or ends while the page is open, re-render it on the
  // server so the leaderboard appears (or the next race shows). Retries until
  // the server's clock agrees, since the browser's may run a little ahead.
  const serverBehind = (!notStarted && serverNow < start) || (ended && serverNow < end);
  useEffect(() => {
    if (!serverBehind) return;
    const id = setTimeout(() => router.refresh(), 3000);
    return () => clearTimeout(id);
  }, [serverBehind, serverNow, router]);
  const parts = split(notStarted ? start - now : end - now);

  // Time left in the browser tab title, e.g. "4d 6h left · ...".
  useEffect(() => {
    const original = document.title.replace(/^.*? left · /, "");
    if (!ended && !notStarted) {
      document.title = `${parts[0].value}d ${parts[1].value}h left · ${original}`;
    }
    return () => {
      document.title = original;
    };
  }, [ended, notStarted, parts[0].value, parts[1].value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ended) {
    return (
      <Notice tone="info" className="font-semibold">
        {finalized ? (
          <>
            This race has ended.{" "}
            <Link href="/history" className="text-cyan underline underline-offset-4 hover:text-text">
              See the winners
            </Link>
          </>
        ) : (
          "This race has ended. Final results are being locked in."
        )}
      </Notice>
    );
  }

  const spoken = `${notStarted ? "Starts" : "Ends"} in ${parts
    .slice(0, 3)
    .map((p) => `${p.value} ${p.label.toLowerCase()}`)
    .join(", ")}`;

  return (
    <div>
      <p className="label-caps mb-2 tracking-[0.2em]">{notStarted ? "Starts in" : "Ends in"}</p>
      {/* The ticking digits are hidden from screen readers; they get a calmer summary instead. */}
      <p className="sr-only">{spoken}</p>
      <div className="flex gap-2 sm:gap-3" aria-hidden="true">
        {parts.map((p) => (
          <div
            key={p.label}
            className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-line bg-ink/55 px-2 py-2.5 shadow-[inset_0_1px_0] shadow-white/5 sm:min-w-18 sm:px-3"
          >
            <span className="font-display text-2xl tabular-nums text-text sm:text-3xl">
              {String(p.value).padStart(2, "0")}
            </span>
            <span className="text-[0.65rem] font-semibold tracking-widest text-muted uppercase">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
