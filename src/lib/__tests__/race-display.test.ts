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
