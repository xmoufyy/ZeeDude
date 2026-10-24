"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SCHEDULE } from "@/lib/period";

const noSubscription = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
// The server doesn't know the viewer's zone, so nothing is rendered until hydration.
const noZone = () => null;

const wallClock = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", minute: "2-digit" }).format(date);

/** "(Sun 11:00 PM your time)" next to an Eastern time, for viewers in another time zone. */
export function LocalTime({ iso }: { iso: string }) {
  const zone = useSyncExternalStore(noSubscription, browserZone, noZone);
  if (!zone) return null;
  const date = new Date(iso);
  const local = wallClock(date, zone);
  if (local === wallClock(date, DEFAULT_SCHEDULE.timeZone)) return null;
  return <span className="whitespace-nowrap text-muted/80"> ({local.replace(",", "")} your time)</span>;
}
