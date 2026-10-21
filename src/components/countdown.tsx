"use client";

import { useEffect, useState } from "react";

type Props = {
  startsAt: string;
  endsAt: string;
  /** Server time at render, so the first client render matches the HTML. */
  serverNow: number;
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

export function Countdown({ startsAt, endsAt, serverNow }: Props) {
  const [now, setNow] = useState(serverNow);
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const notStarted = now < start;
  const ended = now >= end;
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
      <p className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-center font-semibold text-gold">
        This race has ended. Final results are being locked in.
      </p>
    );
  }

  const spoken = `${notStarted ? "Starts" : "Ends"} in ${parts
    .slice(0, 3)
    .map((p) => `${p.value} ${p.label.toLowerCase()}`)
    .join(", ")}`;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-muted uppercase">
        {notStarted ? "Starts in" : "Ends in"}
      </p>
      {/* The ticking digits are hidden from screen readers; they get a calmer summary instead. */}
      <p className="sr-only">{spoken}</p>
      <div className="flex gap-2 sm:gap-3" aria-hidden="true">
        {parts.map((p) => (
          <div key={p.label} className="panel flex min-w-0 flex-1 flex-col items-center px-2 py-2.5 sm:min-w-18 sm:px-3">
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
