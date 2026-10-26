import { describe, expect, it } from "vitest";
import { exportFileStem, matchesStandingQuery, standingsCsv } from "../standings-export";

describe("matchesStandingQuery", () => {
  const row = { rank: 5, username: "DegenDave" };

  it("finds usernames case-insensitively, anywhere in the name", () => {
    expect(matchesStandingQuery(row, "dave")).toBe(true);
    expect(matchesStandingQuery(row, "  DEGEN ")).toBe(true);
    expect(matchesStandingQuery(row, "alice")).toBe(false);
  });

  it("finds a rank with or without #", () => {
    expect(matchesStandingQuery(row, "5")).toBe(true);
    expect(matchesStandingQuery(row, "#5")).toBe(true);
    expect(matchesStandingQuery(row, "#6")).toBe(false);
    expect(matchesStandingQuery({ rank: 1, username: "Player55" }, "55")).toBe(true);
  });

  it("matches everything for an empty query", () => {
    expect(matchesStandingQuery(row, "   ")).toBe(true);
  });
});

describe("standingsCsv", () => {
  it("writes a header, escapes commas and quotes, and leaves unknown cells blank", () => {
    const csv = standingsCsv([
      { rank: 1, username: 'Al,"ice"', wageredSol: 12.5, prizeSol: 4, paid: true, wallet: "Wa11et" },
      { rank: 2, username: "Bob", wageredSol: 3, prizeSol: 0 },
    ]);
    expect(csv.split("\r\n")).toEqual([
      "rank,username,wagered_sol,prize_sol,paid,verified_wallet",
      '1,"Al,""ice""",12.5,4,yes,Wa11et',
      "2,Bob,3,0,,",
      "",
    ]);
  });

  it("neutralises usernames a spreadsheet would run as formulas", () => {
    const csv = standingsCsv([{ rank: 1, username: "=HYPERLINK(\"x\")", wageredSol: 1, prizeSol: 0 }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(standingsCsv([{ rank: 1, username: "@sum", wageredSol: 1, prizeSol: 0 }])).toContain("'@sum");
  });
});

describe("exportFileStem", () => {
  it("makes a safe file name", () => {
    expect(exportFileStem("Week of Oct 18")).toBe("week-of-oct-18");
    expect(exportFileStem('../"evil"\r\n')).toBe("evil");
    expect(exportFileStem("👑")).toBe("period");
  });
});
