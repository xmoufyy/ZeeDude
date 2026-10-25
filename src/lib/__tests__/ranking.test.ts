import { describe, expect, it } from "vitest";
import { rankEntries } from "../ranking";

describe("rankEntries", () => {
  it("sorts by wager, highest first", () => {
    const ranked = rankEntries([
      { username: "low", wageredSol: 1 },
      { username: "high", wageredSol: 10 },
      { username: "mid", wageredSol: 5 },
    ]);
    expect(ranked.map((r) => [r.username, r.rank])).toEqual([
      ["high", 1],
      ["mid", 2],
      ["low", 3],
    ]);
  });

  it("gives tied players the same rank and skips the next (1, 2, 2, 4)", () => {
    const ranked = rankEntries([
      { username: "a", wageredSol: 10 },
      { username: "b", wageredSol: 5 },
      { username: "c", wageredSol: 5 },
      { username: "d", wageredSol: 1 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
    expect(ranked.map((r) => r.position)).toEqual([0, 1, 2, 3]);
  });

  it("treats float noise as a tie", () => {
    const ranked = rankEntries([
      { username: "a", wageredSol: 0.1 + 0.2 },
      { username: "b", wageredSol: 0.3 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("orders tied players alphabetically for a stable display", () => {
    const ranked = rankEntries([
      { username: "zed", wageredSol: 2 },
      { username: "Amy", wageredSol: 2 },
    ]);
    expect(ranked.map((r) => r.username)).toEqual(["Amy", "zed"]);
  });

  it("drops excluded users (case-insensitive) before ranking", () => {
    const ranked = rankEntries(
      [
        { username: "Cheater", wageredSol: 100 },
        { username: "honest", wageredSol: 3 },
      ],
      ["cheater"],
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ username: "honest", rank: 1 });
  });

  it("drops zero, negative and non-finite wagers", () => {
    const ranked = rankEntries([
      { username: "a", wageredSol: 0 },
      { username: "b", wageredSol: -2 },
      { username: "c", wageredSol: Number.NaN },
      { username: "d", wageredSol: 1 },
    ]);
    expect(ranked.map((r) => r.username)).toEqual(["d"]);
  });

  it("merges duplicate usernames regardless of case or whitespace", () => {
    const ranked = rankEntries([
      { username: "Dude", wageredSol: 1.5 },
      { username: " dude ", wageredSol: 2 },
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].username).toBe("Dude");
    expect(ranked[0].wageredSol).toBeCloseTo(3.5);
  });
});

describe("rankEntries tie order", () => {
  it("orders tied names that only differ by accents the same way whatever the input order", () => {
    const a = [
      { username: "José", wageredSol: 5 },
      { username: "Jose", wageredSol: 5 },
    ];
    const names = (rows: typeof a) => rankEntries(rows).map((r) => r.username);
    expect(names(a)).toEqual(names([...a].reverse()));
  });
});
