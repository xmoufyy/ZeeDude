import { describe, expect, it, vi } from "vitest";
import { CsvImportProvider } from "../providers/csv-import";
import { SolpumpApiProvider, solpumpApiConfigFromEnv } from "../providers/solpump-api";
import { ProviderError, toProviderEntries } from "../providers/types";

const period = { id: "p1", startsAt: new Date("2026-10-18T21:00:00Z"), endsAt: new Date("2026-10-25T21:00:00Z") };

describe("toProviderEntries", () => {
  it("returns { username, wagered, rank } sorted by wager, with ties sharing a rank", () => {
    expect(
      toProviderEntries([
        { username: "b", wageredSol: 5 },
        { username: "a", wageredSol: 10, wageredUsd: 2000 },
        { username: "c", wageredSol: 5 },
      ]),
    ).toEqual([
      { username: "a", wagered: 10, wageredUsd: 2000, rank: 1 },
      { username: "b", wagered: 5, wageredUsd: undefined, rank: 2 },
      { username: "c", wagered: 5, wageredUsd: undefined, rank: 2 },
    ]);
  });

  it("keeps zero-wager players at the bottom instead of dropping them", () => {
    const entries = toProviderEntries([
      { username: "zero", wageredSol: 0 },
      { username: "a", wageredSol: 1 },
    ]);
    expect(entries.map((e) => [e.username, e.rank])).toEqual([
      ["a", 1],
      ["zero", 2],
    ]);
  });
});

describe("CsvImportProvider", () => {
  it("parses and ranks a file", async () => {
    const provider = new CsvImportProvider("user,wagered\nlow,1\nhigh,9\nhigh,1\n", "csv");
    const entries = await provider.fetchEntries();
    expect(entries.map((e) => [e.username, e.wagered, e.rank])).toEqual([
      ["high", 10, 1],
      ["low", 1, 2],
    ]);
    expect(provider.stats.duplicatesMerged).toBe(1);
  });

  it("throws a ProviderError listing bad rows", async () => {
    const provider = new CsvImportProvider("user,wagered\nbob,-1\n", "csv");
    await expect(provider.fetchEntries()).rejects.toMatchObject({
      name: "ProviderError",
      details: ["Line 2: wagered SOL can't be negative"],
    });
  });
});

describe("SolpumpApiProvider (stub)", () => {
  it("reads config only when both URL and key are set", () => {
    expect(solpumpApiConfigFromEnv({ SOLPUMP_API_URL: "https://x" })).toBeNull();
    expect(
      solpumpApiConfigFromEnv({ SOLPUMP_API_URL: "https://x", SOLPUMP_API_KEY: "k" }),
    ).toEqual({ baseUrl: "https://x", apiKey: "k" });
  });

  it("refuses to run without config", async () => {
    await expect(new SolpumpApiProvider(null).fetchEntries(period)).rejects.toBeInstanceOf(ProviderError);
  });

  it("never makes a network request while it's a stub", async () => {
    const fetchSpy = vi.fn();
    const provider = new SolpumpApiProvider({ baseUrl: "https://api.example", apiKey: "k" }, fetchSpy);
    await expect(provider.fetchEntries(period)).rejects.toThrow(/stub/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
