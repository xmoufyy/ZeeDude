import { describe, expect, it } from "vitest";
import { assignPrizes, computePlacePrizes, isValidSplit } from "../payouts";
import { rankEntries } from "../ranking";
import { solToLamports } from "../sol";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("isValidSplit", () => {
  it("accepts splits totalling 100%", () => {
    expect(isValidSplit([50, 30, 20])).toBe(true);
    expect(isValidSplit([33.33, 33.33, 33.34])).toBe(true);
  });

  it("rejects bad splits", () => {
    expect(isValidSplit([])).toBe(false);
    expect(isValidSplit([50, 40])).toBe(false);
    expect(isValidSplit([110, -10])).toBe(false);
    expect(isValidSplit([100, 0])).toBe(false);
    expect(isValidSplit([Number.NaN, 100])).toBe(false);
  });
});

describe("computePlacePrizes", () => {
  it("splits a pool by percentage", () => {
    const prizes = computePlacePrizes(10, [50, 30, 20]);
    expect(prizes.map((p) => p.sol)).toEqual([5, 3, 2]);
    expect(prizes.map((p) => p.place)).toEqual([1, 2, 3]);
  });

  it("always adds up to exactly the pool, down to the lamport", () => {
    const prizes = computePlacePrizes(1, [33.33, 33.33, 33.34]);
    expect(sum(prizes.map((p) => p.lamports))).toBe(solToLamports(1));

    const thirds = computePlacePrizes(0.000000001 * 10, [100 / 3, 100 / 3, 100 / 3]);
    expect(sum(thirds.map((p) => p.lamports))).toBe(10);
    // The extra lamport goes to the better place.
    expect(thirds.map((p) => p.lamports)).toEqual([4, 3, 3]);
  });

  it("throws on an invalid split", () => {
    expect(() => computePlacePrizes(10, [50, 20])).toThrow();
  });
});

describe("assignPrizes", () => {
  const prizes = computePlacePrizes(10, [50, 30, 20]);

  it("pays places in order and gives 0 beyond the paid places", () => {
    const ranked = rankEntries([
      { username: "a", wageredSol: 40 },
      { username: "b", wageredSol: 30 },
      { username: "c", wageredSol: 20 },
      { username: "d", wageredSol: 10 },
    ]);
    expect(assignPrizes(ranked, prizes).map((e) => e.prizeSol)).toEqual([5, 3, 2, 0]);
  });

  it("splits the combined prize of tied places evenly", () => {
    const ranked = rankEntries([
      { username: "a", wageredSol: 40 },
      { username: "b", wageredSol: 30 },
      { username: "c", wageredSol: 30 },
    ]);
    // 2nd and 3rd tie: (3 + 2) / 2 = 2.5 each
    expect(assignPrizes(ranked, prizes).map((e) => e.prizeSol)).toEqual([5, 2.5, 2.5]);
  });

  it("splits a tie that straddles the last paid place", () => {
    const ranked = rankEntries([
      { username: "a", wageredSol: 40 },
      { username: "b", wageredSol: 30 },
      { username: "c", wageredSol: 20 },
      { username: "d", wageredSol: 20 },
    ]);
    // 3rd place (2 SOL) shared by two players tied for 3rd
    expect(assignPrizes(ranked, prizes).map((e) => e.prizeSol)).toEqual([5, 3, 1, 1]);
  });

  it("never pays out more than the pool when a split doesn't divide evenly", () => {
    const tiny = computePlacePrizes(0.000000001 * 10, [100]); // 10 lamports
    const ranked = rankEntries([
      { username: "a", wageredSol: 1 },
      { username: "b", wageredSol: 1 },
      { username: "c", wageredSol: 1 },
    ]);
    const paid = assignPrizes(ranked, tiny).map((e) => e.prizeLamports);
    expect(paid).toEqual([4, 3, 3]);
    expect(sum(paid)).toBe(10);
  });

  it("moves prizes down when a winner is excluded", () => {
    const entries = [
      { username: "banned", wageredSol: 100 },
      { username: "a", wageredSol: 40 },
      { username: "b", wageredSol: 30 },
    ];
    const prized = assignPrizes(rankEntries(entries, ["banned"]), prizes);
    expect(prized.map((e) => [e.username, e.rank, e.prizeSol])).toEqual([
      ["a", 1, 5],
      ["b", 2, 3],
    ]);
  });

  it("leaves unclaimed places unpaid when there are fewer players than places", () => {
    const prized = assignPrizes(rankEntries([{ username: "solo", wageredSol: 1 }]), prizes);
    expect(prized.map((e) => e.prizeSol)).toEqual([5]);
  });
});
