import { describe, expect, it } from "vitest";
import { maskUsername } from "../mask";
import { weeklyWindow, weeklyWindowOffset, zonedTimeToUtc } from "../period";

describe("maskUsername", () => {
  it("uses a fixed-length mask so name length isn't leaked", () => {
    expect(maskUsername("ZeeDudeFan")).toBe("Ze****an");
    expect(maskUsername("ZeeDudeFanClub2026")).toBe("Ze****26");
    expect(maskUsername("Dudes")).toBe("Du****");
    expect(maskUsername("Zed")).toBe("Z****");
    expect(maskUsername("Z")).toBe("Z****");
    expect(maskUsername("")).toBe("****");
  });

  it("doesn't split emoji or other multi-byte characters", () => {
    expect(maskUsername("☯dudeman☯")).toBe("☯d****n☯");
  });
});

describe("zonedTimeToUtc", () => {
  it("handles Eastern daylight and standard time", () => {
    expect(zonedTimeToUtc(2026, 10, 18, 17, 0, "America/New_York").toISOString()).toBe(
      "2026-10-18T21:00:00.000Z",
    );
    expect(zonedTimeToUtc(2026, 11, 8, 17, 0, "America/New_York").toISOString()).toBe(
      "2026-11-08T22:00:00.000Z",
    );
  });
});

describe("weeklyWindow (Sunday 5 PM Eastern)", () => {
  it("finds the current week", () => {
    const { start, end } = weeklyWindow(new Date("2026-10-21T19:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-18T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T21:00:00.000Z");
  });

  it("is still last week on Sunday before 5 PM, and the new week right at 5 PM", () => {
    const before = weeklyWindow(new Date("2026-10-25T20:59:59Z"));
    expect(before.start.toISOString()).toBe("2026-10-18T21:00:00.000Z");

    const at = weeklyWindow(new Date("2026-10-25T21:00:00Z"));
    expect(at.start.toISOString()).toBe("2026-10-25T21:00:00.000Z");
  });

  it("keeps the reset at 5 PM local across the November DST change", () => {
    const { start, end } = weeklyWindow(new Date("2026-11-03T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-01T22:00:00.000Z"); // 5 PM EST
    expect(end.toISOString()).toBe("2026-11-08T22:00:00.000Z");

    const dstWeek = weeklyWindow(new Date("2026-10-28T12:00:00Z"));
    expect(dstWeek.start.toISOString()).toBe("2026-10-25T21:00:00.000Z"); // 5 PM EDT
    expect(dstWeek.end.toISOString()).toBe("2026-11-01T22:00:00.000Z"); // 5 PM EST
  });

  it("steps back and forward whole weeks", () => {
    const now = new Date("2026-10-21T19:00:00Z");
    expect(weeklyWindowOffset(now, -1).start.toISOString()).toBe("2026-10-11T21:00:00.000Z");
    expect(weeklyWindowOffset(now, 2).start.toISOString()).toBe("2026-11-01T22:00:00.000Z");
  });
});
