"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const REFRESH_MS = 2 * 60_000;

function relative(iso: string, now: number) {
  const minutes = Math.round((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Re-fetches the page data every couple of minutes while the tab is visible. */
export function AutoRefresh({ updatedAt, serverNow }: { updatedAt: string | null; serverNow: number }) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-cyan" />
      </span>
      {updatedAt ? (
        <span>
          Last updated{" "}
          <time dateTime={updatedAt} title={new Date(updatedAt).toUTCString()}>
            {relative(updatedAt, now)}
          </time>
        </span>
      ) : (
        <span>Waiting for the first data import</span>
      )}
      <span className="basis-full text-xs text-muted/80">
        Totals are imported from SolPump, so recent bets can take a while to show up.
      </span>
    </p>
  );
}
