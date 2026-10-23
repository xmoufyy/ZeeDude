import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GapNote, MoveBadge } from "@/components/move-badge";
import { gapsToNextPlace, hallOfFame, rankMoves } from "../board-stats";
import { maskHallForFallback } from "../fallback-sanitize";
import type { StandingRow } from "../standings";

const row = (rank: number, username: string, wageredSol: number, prizeSol = 0): StandingRow => ({ rank, username, wageredSol, prizeSol });

describe("rankMoves", () => {
  const before = [row(1, "Alice", 10), row(2, "Bob", 8), row(3, "Cara", 5)];
  const now = [row(1, "Bob", 12), row(2, "alice", 10), row(3, "Cara", 6), row(4, "Dan", 1)];

  it("compares with the newest snapshot that differs from the current standings", () => {
    // The newest snapshot is identical to now (taken right after the import), so the one before it counts.
    const moves = rankMoves(now, [JSON.stringify(now), JSON.stringify(before)]);
    expect(Object.fromEntries(moves!)).toEqual({ bob: 1, alice: -1, cara: 0, dan: "new" });
  });

  it("has no arrows without an earlier, different snapshot", () => {
    expect(rankMoves(now, [])).toBeNull();
    expect(rankMoves(now, [JSON.stringify(now)])).toBeNull();
  });
});

describe("gapsToNextPlace", () => {
  it("measures to the next better rank, skipping players tied with you, in exact lamports", () => {
    const gaps = gapsToNextPlace([row(1, "A", 10.3), row(2, "B", 10.1), row(2, "C", 10.1), row(4, "D", 3)]);
    expect(gaps.get("a")).toBeUndefined();
    expect(gaps.get("b")).toEqual({ sol: 0.2, rank: 1 });
    expect(gaps.get("c")).toEqual({ sol: 0.2, rank: 1 });
    expect(gaps.get("d")).toEqual({ sol: 7.1, rank: 2 });
  });

  it("gives players tied for first no gap", () => {
    expect(gapsToNextPlace([row(1, "A", 5), row(1, "B", 5)]).size).toBe(0);
  });
});

describe("hallOfFame", () => {
  const finals = [
    { endsAt: new Date("2026-10-18T21:00:00Z"), rows: [row(1, "alice", 50, 4), row(2, "Bob", 40, 2), row(3, "Cheat", 30, 1.2)] },
    { endsAt: new Date("2026-10-25T21:00:00Z"), rows: [row(1, "Bob", 60, 4), row(2, "Alice", 20.1, 2), row(4, "Dan", 1)] },
  ];

  it("totals wins, podiums, SOL won and wagered per player across races, minus excluded players", () => {
    expect(hallOfFame(finals, ["cheat"])).toEqual([
      { username: "Alice", wins: 1, podiums: 2, races: 2, wonSol: 6, wageredSol: 70.1, bestWeekSol: 50 },
      { username: "Bob", wins: 1, podiums: 2, races: 2, wonSol: 6, wageredSol: 100, bestWeekSol: 60 },
      { username: "Dan", wins: 0, podiums: 0, races: 1, wonSol: 0, wageredSol: 1, bestWeekSol: 1 },
    ].sort((a, b) => b.wonSol - a.wonSol || b.wins - a.wins || b.wageredSol - a.wageredSol));
  });

  it("masks every name in its outage copy", () => {
    const hall = { rows: [{ name: "ZeeDudeFan" }], champions: [{ name: "WhaleWatcher" }], masked: false };
    expect(maskHallForFallback(hall)).toEqual({ rows: [{ name: "Ze****an" }], champions: [{ name: "Wh****er" }], masked: true });
  });
});

describe("MoveBadge and GapNote", () => {
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<[^>]+>/g, "");

  it("renders climbs, drops, newcomers, and nothing when unchanged", () => {
    expect(html(createElement(MoveBadge, { move: 2 }))).toBe("▲up 2");
    expect(html(createElement(MoveBadge, { move: -1 }))).toBe("▼down 1");
    expect(html(createElement(MoveBadge, { move: "new" }))).toBe("NEW");
    expect(html(createElement(MoveBadge, { move: 0 }))).toBe("");
  });

  it("shows the gap to the next place", () => {
    expect(html(createElement(GapNote, { gapSol: 0.8, gapRank: 3 }))).toBe("0.80 SOL behind #3");
    expect(html(createElement(GapNote, {}))).toBe("");
  });
});
