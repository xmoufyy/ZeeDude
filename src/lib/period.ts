// Weekly period math in a real time zone, so resets stay at 5 PM Eastern
// across daylight-saving changes (5 PM EDT = 21:00 UTC, 5 PM EST = 22:00 UTC).

export type WeeklySchedule = {
  timeZone: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  hour: number;
  minute: number;
};

export const DEFAULT_SCHEDULE: WeeklySchedule = {
  timeZone: "America/New_York",
  weekday: 0,
  hour: 17,
  minute: 0,
};

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
function zoneOffset(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, date.getUTCSeconds());
  return asUtc - (date.getTime() - date.getUTCMilliseconds());
}

/** Converts a wall-clock time in `timeZone` to a UTC Date. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - zoneOffset(new Date(guess), timeZone);
  // A second pass corrects guesses that landed on the other side of a DST change.
  result = guess - zoneOffset(new Date(result), timeZone);
  return new Date(result);
}

/** The weekly window that contains `now`: [start, end). */
export function weeklyWindow(now: Date, schedule: WeeklySchedule = DEFAULT_SCHEDULE) {
  const local = localParts(now, schedule.timeZone);
  const daysBack = (local.weekday - schedule.weekday + 7) % 7;
  const startOf = (offsetDays: number) => {
    // Day arithmetic on a UTC calendar date, then re-anchored in the zone.
    const d = new Date(Date.UTC(local.year, local.month - 1, local.day - daysBack + offsetDays));
    return zonedTimeToUtc(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      schedule.hour,
      schedule.minute,
      schedule.timeZone,
    );
  };

  let start = startOf(0);
  let shift = 0;
  if (start.getTime() > now.getTime()) {
    shift = -7;
    start = startOf(shift);
  }
  return { start, end: startOf(shift + 7) };
}

/** Window `weeksFromNow` weeks away from the one containing `now` (negative = past). */
export function weeklyWindowOffset(
  now: Date,
  weeksFromNow: number,
  schedule: WeeklySchedule = DEFAULT_SCHEDULE,
) {
  let window = weeklyWindow(now, schedule);
  const step = weeksFromNow < 0 ? -1 : 1;
  for (let i = 0; i !== weeksFromNow; i += step) {
    // Hop 1 hour past the boundary in the right direction and recompute, so
    // DST weeks (167h or 169h long) are handled by weeklyWindow itself.
    const probe = step > 0 ? window.end.getTime() + 3_600_000 : window.start.getTime() - 3_600_000;
    window = weeklyWindow(new Date(probe), schedule);
  }
  return window;
}

const rangeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: DEFAULT_SCHEDULE.timeZone,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** "Sun, Oct 18, 5:00 PM EDT" in the leaderboard's home time zone. */
export function formatPeriodDate(date: Date | string): string {
  return rangeFormat.format(new Date(date));
}

const shortFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: DEFAULT_SCHEDULE.timeZone,
  month: "short",
  day: "numeric",
});

/** "Oct 18 – Oct 25" */
export function formatPeriodRange(start: Date | string, end: Date | string): string {
  return `${shortFormat.format(new Date(start))} – ${shortFormat.format(new Date(end))}`;
}
