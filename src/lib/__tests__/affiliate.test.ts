import { describe, expect, it } from "vitest";
import { BOUNDARY_GRACE_MS, parseAffiliatePaste, pickSnapshots, weeklyTotals } from "../affiliate";

// Text as copied from SolPump's affiliate page: label and value on separate lines.
const PAGE_COPY = `
⊰NoahReapwe⊱✓
Wagered
559.0603
Comission
Generated
0.4006
First Seen
09/20/2026, 05:13 AM
Last Seen
10/14/2026, 09:40 PM
alternativewater ✓
Wagered
17.6398
Comission
Generated
0.0161
First Seen
08/05/2026, 03:05 AM
Last Seen
10/02/2026, 04:26 AM
`;

describe("parseAffiliatePaste", () => {
  it("reads names and wagered totals from a page copy, ignoring commission and dates", () => {
    expect(parseAffiliatePaste(PAGE_COPY)).toEqual({
      rows: [
        { username: "⊰NoahReapwe⊱", lifetimeSol: 559.0603 },
        { username: "alternativewater", lifetimeSol: 17.6398 },
      ],
      warnings: [],
      errors: [],
    });
  });

  it("handles label and amount on one line, avatar text, and thousands separators", () => {
    const text = "avatar\nMario4k\nWagered ◎ 1,210.28\nComission Generated 0.0102\nWoskiruski Wagered 3.8564";
    expect(parseAffiliatePaste(text).rows).toEqual([
      { username: "Mario4k", lifetimeSol: 1210.28 },
      { username: "Woskiruski", lifetimeSol: 3.8564 },
    ]);
  });

  it("falls back to name, amount lines", () => {
    expect(parseAffiliatePaste("Barney, 2.9009\nSares\t2.5786").rows).toEqual([
      { username: "Barney", lifetimeSol: 2.9009 },
      { username: "Sares", lifetimeSol: 2.5786 },
    ]);
  });

  it("merges a page copied twice and warns when totals disagree", () => {
    const result = parseAffiliatePaste("Bob\nWagered 1\nbob\nWagered 1\nAmy\nWagered 2\nAmy\nWagered 3");
    expect(result.rows).toEqual([
      { username: "Bob", lifetimeSol: 1 },
      { username: "Amy", lifetimeSol: 3 },
    ]);
    expect(result.warnings).toHaveLength(1);
  });

  it("reports unreadable amounts and empty pastes", () => {
    expect(parseAffiliatePaste("Bob\nWagered\nlots").errors[0]).toMatch(/amount for Bob/);
    expect(parseAffiliatePaste("hello there").errors[0]).toMatch(/No players found/);
  });
});

describe("pickSnapshots", () => {
  const at = (iso: string, id = iso) => ({ id, takenAt: new Date(iso) });
  const week = { startsAt: new Date("2026-10-18T21:00:00Z"), endsAt: new Date("2026-10-25T21:00:00Z") };

  it("compares the latest copy with the one closest to the week's start", () => {
    const snaps = [at("2026-10-11T21:05:00Z"), at("2026-10-18T21:03:00Z"), at("2026-10-20T12:00:00Z"), at("2026-10-22T12:00:00Z")];
    const picked = pickSnapshots(snaps, week);
    expect(picked.baseline?.id).toBe("2026-10-18T21:03:00Z");
    expect(picked.latest?.id).toBe("2026-10-22T12:00:00Z");
    expect(picked.baselineOffMs).toBe(3 * 60_000);
  });

  it("a copy taken just after the boundary ends the old week and starts the new one", () => {
    const boundary = at("2026-10-25T21:02:00Z");
    const snaps = [at("2026-10-18T21:00:00Z"), boundary, at("2026-10-26T12:00:00Z")];
    expect(pickSnapshots(snaps, week).latest).toBe(boundary);
    const next = { startsAt: week.endsAt, endsAt: new Date(week.endsAt.getTime() + 7 * 864e5) };
    expect(pickSnapshots(snaps, next).baseline).toBe(boundary);
  });

  it("has no baseline with a single copy and nothing for a week with no copies yet", () => {
    expect(pickSnapshots([at("2026-10-20T00:00:00Z")], week)).toMatchObject({ baseline: null });
    expect(pickSnapshots([at("2026-10-01T00:00:00Z")], week)).toEqual({ latest: null, baseline: null, baselineOffMs: null });
    const lateBoundary = new Date(week.endsAt.getTime() + BOUNDARY_GRACE_MS + 1);
    expect(pickSnapshots([at("2026-10-18T21:00:00Z"), { id: "late", takenAt: lateBoundary }], week).latest?.id).toBe("2026-10-18T21:00:00Z");
  });
});

describe("weeklyTotals", () => {
  it("subtracts the baseline exactly, counts newcomers in full and drops zero rows", () => {
    const { rows, warnings } = weeklyTotals(
      [
        { username: "Noah", lifetimeSol: 559.0603 },
        { username: "Mario", lifetimeSol: 10.28 },
        { username: "Idle", lifetimeSol: 5 },
      ],
      [
        { username: "noah", lifetimeSol: 500.0001 },
        { username: "Idle", lifetimeSol: 5 },
      ],
    );
    expect(rows).toEqual([
      { username: "Noah", wageredSol: 59.0602, lifetimeSol: 559.0603 },
      { username: "Mario", wageredSol: 10.28, lifetimeSol: 10.28 },
    ]);
    expect(warnings).toEqual([]);
  });

  it("warns about totals that went down and players missing from the latest copy", () => {
    const { rows, warnings } = weeklyTotals(
      [{ username: "A", lifetimeSol: 1 }],
      [
        { username: "A", lifetimeSol: 2 },
        { username: "B", lifetimeSol: 1 },
      ],
    );
    expect(rows).toEqual([]);
    expect(warnings).toHaveLength(2);
  });
});
