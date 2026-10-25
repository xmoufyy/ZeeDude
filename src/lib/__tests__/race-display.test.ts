import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Countdown } from "@/components/countdown";
import { Podium } from "@/components/podium";
import { computePlacePrizes } from "../payouts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Podium", () => {
  const prizes = computePlacePrizes(10, [40, 20, 12, 8, 6, 4, 3, 3, 2, 2]);
  const leader = { rank: 1, name: "MonkeyMan", wageredSol: 4.2, prizeSol: 4 };

  it("shows what an empty place pays on a live race", () => {
    const html = text(renderToStaticMarkup(createElement(Podium, { rows: [leader], placePrizes: prizes })));
    expect(html).toContain("Open spot");
    expect(html).toMatch(/Up for grabs 2 SOL/);
    expect(html).toMatch(/Up for grabs 1\.2 SOL/);
  });

  it("doesn't show a wager for an open spot as if someone wagered 0", () => {
    const html = text(renderToStaticMarkup(createElement(Podium, { rows: [leader], placePrizes: prizes })));
    expect(html).not.toMatch(/Wagered 0 SOL/);
    expect(html).toMatch(/Wagered — /);
  });

  it("shows 0 for an empty place on a finished race", () => {
    const html = text(renderToStaticMarkup(createElement(Podium, { rows: [leader] })));
    expect(html).not.toContain("Up for grabs");
    expect(html).toMatch(/Prize 0 SOL/);
  });
});

describe("Countdown", () => {
  const props = { startsAt: "2026-10-18T21:00:00Z", endsAt: "2026-10-25T21:00:00Z", serverNow: Date.parse("2026-10-26T00:00:00Z") };

  it("points to Past Winners once an ended race is finalized", () => {
    const html = renderToStaticMarkup(createElement(Countdown, { ...props, finalized: true }));
    expect(html).toContain('href="/history"');
    expect(text(html)).not.toContain("being locked in");
  });

  it("says results are being locked in while an ended race is unconfirmed", () => {
    expect(text(renderToStaticMarkup(createElement(Countdown, props)))).toContain("being locked in");
  });
});

describe("PrizeBreakdown", () => {
  it("writes ordinals correctly past 20th place", async () => {
    const { PrizeBreakdown } = await import("@/components/prize-breakdown");
    const split = Array.from({ length: 25 }, () => 4);
    const html = text(renderToStaticMarkup(createElement(PrizeBreakdown, { prizes: computePlacePrizes(25, split), poolSol: 25 })));
    for (const place of ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "24th"]) {
      expect(html).toContain(`${place} place`);
    }
    expect(html).not.toMatch(/2[123]th place/);
  });
});

describe("LeaderboardTable", () => {
  const prizeRow = (rank: number, prizeSol: number) => ({ rank, name: `P${rank}`, wageredSol: 10 - rank / 10, prizeSol });

  it("marks where the paid places end", async () => {
    const { LeaderboardTable } = await import("@/components/leaderboard-table");
    const rows = [prizeRow(4, 0.8), prizeRow(5, 0.6), prizeRow(6, 0)];
    const html = text(renderToStaticMarkup(createElement(LeaderboardTable, { rows, caption: "x" })));
    expect(html).toMatch(/P5 .* Prize places end here .* P6/);
  });

  it("shows the given empty message, so a finished race doesn't invite players to climb it", async () => {
    const { LeaderboardTable } = await import("@/components/leaderboard-table");
    const html = text(renderToStaticMarkup(createElement(LeaderboardTable, { rows: [], caption: "x", emptyText: "Nobody wagered in this race." })));
    expect(html).toContain("Nobody wagered in this race.");
    expect(html).not.toContain("Be the first");
  });
});
