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
  it("rejects extra number columns and decimal commas instead of importing commission or a larger total", () => {
    for (const text of ["Alice, 1.5, 0.3", "Alice\t1.5\t0.3", "Alice  1.5  0.3"]) {
      expect(parseAffiliatePaste(text).errors[0], text).toMatch(/more than one number/);
    }
    expect(parseAffiliatePaste("Alice; 1,5").errors[0]).toMatch(/amount for Alice/);
    expect(parseAffiliatePaste("Alice\nWagered 1,5\nGenerated 0.1").errors[0]).toMatch(/amount for Alice/);
    expect(parseAffiliatePaste("Agent 47  1.5").rows).toEqual([{ username: "Agent 47", lifetimeSol: 1.5 }]);
  });
  it("rejects a malformed first row instead of mistaking it for a header", () => {
    expect(parseAffiliatePaste("Bob, nope\nAlice, 100").errors[0]).toMatch(/Line 1/);
  });

  it("does not discard a player just because a later card has metadata", () => {
    expect(parseAffiliatePaste("Alice Wagered 10\nBob Wagered 20 Generated 1").rows).toEqual([
      { username: "Alice", lifetimeSol: 10 },
      { username: "Bob", lifetimeSol: 20 },
    ]);
  });
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

  it("reads other copy layouts: tab-separated columns and everything flattened onto one line", () => {
    const tabs = [
      "⊰NoahReapwe⊱ ✓",
      "Wagered\t559.0603\tComission",
      "Generated\t0.4006\tFirst Seen\t09/20/2026, 05:13 AM\tLast Seen\t10/14/2026, 09:40 PM",
      "Mario4k ✓",
      "Wagered\t10.2800\tComission",
      "Generated\t0.0102",
    ].join("\n");
    const flat =
      "⊰NoahReapwe⊱✓ Wagered 559.0603 Comission Generated 0.4006 First Seen 09/20/2026, 05:13 AM Last Seen 10/14/2026, 09:40 PM " +
      "BASTI7 ✓ Wagered 0.6574 Comission Generated 0.0006 First Seen 09/30/2026, 01:36 PM Last Seen 10/09/2026, 05:52 PM";
    expect(parseAffiliatePaste(tabs)).toEqual({
      rows: [
        { username: "⊰NoahReapwe⊱", lifetimeSol: 559.0603 },
        { username: "Mario4k", lifetimeSol: 10.28 },
      ],
      warnings: [],
      errors: [],
    });
    expect(parseAffiliatePaste(flat).rows).toEqual([
      { username: "⊰NoahReapwe⊱", lifetimeSol: 559.0603 },
      { username: "BASTI7", lifetimeSol: 0.6574 },
    ]);
  });

  it("skips page totals above the list and keeps all-digit names", () => {
    const text = "Affiliate\nTotal Wagered\n600.5 SOL\nReferrals 24\n12345\nWagered\n5\nComission\nGenerated\n0.1\nBarney\nWagered\n2.9009";
    const result = parseAffiliatePaste(text);
    expect(result.rows).toEqual([
      { username: "12345", lifetimeSol: 5 },
      { username: "Barney", lifetimeSol: 2.9009 },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.warnings[0]).toMatch(/above the player list/);
  });

  it("rejects a simple list with any unreadable line (and allows a header)", () => {
    expect(parseAffiliatePaste("Alice, 100\nBob, nope").errors[0]).toMatch(/Line 2: expected "name, amount"/);
    expect(parseAffiliatePaste("username, wagered\nAlice, 100")).toEqual({ rows: [{ username: "Alice", lifetimeSol: 100 }], warnings: [], errors: [] });
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
    expect(parseAffiliatePaste("hello there").errors[0]).toMatch(/Line 1: expected "name, amount"/);
    expect(parseAffiliatePaste(" \n ").errors[0]).toMatch(/No players found/);
  });

  it("keeps label words inside names and rejects malformed amounts", () => {
    const text = "RegeneratedKing ✓\nWagered 100\nComission Generated 1\nLastSeenFan\nWagered 2\nComission Generated 0.1";
    expect(parseAffiliatePaste(text).rows).toEqual([
      { username: "RegeneratedKing", lifetimeSol: 100 },
      { username: "LastSeenFan", lifetimeSol: 2 },
    ]);
    expect(parseAffiliatePaste("Alice\nWagered 1e10\nComission Generated 1").errors[0]).toMatch(/amount for Alice/);
    expect(parseAffiliatePaste("Alice\nWagered 5.5.5\nComission Generated 1").errors[0]).toMatch(/amount for Alice/);
  });

  it("only treats a delimited first line as a list header", () => {
    expect(parseAffiliatePaste("Bob nope\nAlice, 100").errors[0]).toMatch(/Line 1: expected "name, amount"/);
  });

  it("reads a first card with a tab between the name and Wagered", () => {
    expect(parseAffiliatePaste("Alice\tWagered\n100\nGenerated 1\nBob\tWagered\n200\nGenerated 2")).toEqual({
      rows: [
        { username: "Alice", lifetimeSol: 100 },
        { username: "Bob", lifetimeSol: 200 },
      ],
      warnings: [],
      errors: [],
    });
  });

  it("keeps names with a standalone number inside, and strips only the previous card's amounts", () => {
    expect(parseAffiliatePaste("Agent 47 Smith\nWagered 100\nGenerated 1").rows).toEqual([{ username: "Agent 47 Smith", lifetimeSol: 100 }]);
    const flat = "Noah Wagered 5 Comission Generated 0.4006 Agent 47 Smith Wagered 3 Comission Generated 0.1";
    expect(parseAffiliatePaste(flat).rows).toEqual([
      { username: "Noah", lifetimeSol: 5 },
      { username: "Agent 47 Smith", lifetimeSol: 3 },
    ]);
    expect(parseAffiliatePaste("Noah\nWagered 5\nComission\nGenerated\n0.4006\nWagered 3").errors[0]).toMatch(/no player name/);
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

  it("never compares a copy with another taken at the same time; later saves win ties", () => {
    const t = "2026-10-20T00:00:00Z";
    const first = { id: "first", takenAt: new Date(t), createdAt: new Date("2026-10-20T00:01:00Z") };
    const again = { id: "again", takenAt: new Date(t), createdAt: new Date("2026-10-20T00:02:00Z") };
    expect(pickSnapshots([again, first], week)).toMatchObject({ latest: again, baseline: null });
    const start = at("2026-10-18T21:00:00Z");
    expect(pickSnapshots([first, start, again], week)).toMatchObject({ latest: again, baseline: start });
  });

  it("uses a correction saved at the baseline's time instead of the original", () => {
    const original = { id: "original", takenAt: new Date("2026-10-18T21:00:00Z"), createdAt: new Date("2026-10-18T21:01:00Z") };
    const correction = { id: "correction", takenAt: new Date("2026-10-18T21:00:00Z"), createdAt: new Date("2026-10-18T21:05:00Z") };
    const later = { id: "later", takenAt: new Date("2026-10-21T12:00:00Z"), createdAt: new Date("2026-10-21T12:00:00Z") };
    expect(pickSnapshots([original, correction, later], week)).toMatchObject({ latest: later, baseline: correction });
  });

  it("has no baseline with a single copy and nothing for a week with no copies yet", () => {
    expect(pickSnapshots([at("2026-10-20T00:00:00Z")], week)).toMatchObject({ baseline: null });
    expect(pickSnapshots([at("2026-10-01T00:00:00Z")], week)).toEqual({ latest: null, baseline: null, baselineOffMs: null });
    const lateBoundary = new Date(week.endsAt.getTime() + BOUNDARY_GRACE_MS + 1);
    expect(pickSnapshots([at("2026-10-20T00:00:00Z"), { id: "late", takenAt: lateBoundary }], week).latest?.id).toBe("2026-10-20T00:00:00Z");
  });

  it("treats a copy near the start as the starting point only, never the latest", () => {
    // Sunday 5 PM copy alone in the new week: no totals yet, rather than
    // comparing it with a mid-week copy from the week before.
    const lastWeek = at("2026-10-16T18:00:00Z");
    const boundary = at("2026-10-18T21:02:00Z");
    expect(pickSnapshots([lastWeek, boundary], week)).toEqual({ latest: null, baseline: null, baselineOffMs: null });
    // Same for a copy just before the start, or within the hour after it.
    expect(pickSnapshots([lastWeek, at("2026-10-18T20:30:00Z")], week).latest).toBeNull();
    expect(pickSnapshots([lastWeek, at("2026-10-18T21:59:00Z")], week).latest).toBeNull();
    // Once a later copy arrives, the boundary copy is the baseline.
    const midWeek = at("2026-10-20T12:00:00Z");
    expect(pickSnapshots([lastWeek, boundary, midWeek], week)).toMatchObject({ latest: midWeek, baseline: boundary });
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
