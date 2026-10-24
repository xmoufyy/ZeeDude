import { describe, expect, it } from "vitest";
import { parseAmount, parseCsv, parseWagerFile } from "../import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas in fields and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });

  it("detects semicolon and tab delimiters and strips a BOM", () => {
    expect(parseCsv("﻿user;wagered\nbob;1,5")).toEqual([
      ["user", "wagered"],
      ["bob", "1,5"],
    ]);
    expect(parseCsv("user\twagered\nbob\t2")).toEqual([
      ["user", "wagered"],
      ["bob", "2"],
    ]);
  });
});

describe("parseAmount", () => {
  it("strips units, symbols and thousands separators", () => {
    expect(parseAmount("1,234.5 SOL")).toBe(1234.5);
    expect(parseAmount("◎ 12")).toBe(12);
    expect(parseAmount("$99.10")).toBe(99.1);
    expect(parseAmount(7)).toBe(7);
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("abc")).toBeNaN();
  });

  it("only accepts commas as thousands separators, so a decimal comma isn't read 10x too big", () => {
    expect(parseAmount("1,234,567.89")).toBe(1234567.89);
    expect(parseAmount("1,5")).toBeNaN();
    expect(parseAmount("12,50")).toBeNaN();
    expect(parseAmount("1,2345")).toBeNaN();
    expect(parseWagerFile("username;wagered\nAlice;1,5", "csv")).toEqual({ ok: false, errors: [expect.stringMatching(/Line 2: wagered SOL is not a number/)] });
  });
});

describe("parseWagerFile (CSV)", () => {
  it("parses a simple export with loosely named headers", () => {
    const result = parseWagerFile("Player,Wagered (SOL),Wagered USD\nSolSurfer,12.5,2500\nDegenDave,3,\n", "csv");
    expect(result).toEqual({
      ok: true,
      rows: [
        { username: "SolSurfer", wageredSol: 12.5, wageredUsd: 2500 },
        { username: "DegenDave", wageredSol: 3, wageredUsd: undefined },
      ],
      duplicatesMerged: 0,
      skippedBlank: 0,
    });
  });

  it("merges duplicate players case-insensitively and skips blank lines", () => {
    const result = parseWagerFile("username,wagered\nBob,1\n,\nbob,2.5\n", "csv");
    expect(result.ok && result.rows).toEqual([{ username: "Bob", wageredSol: 3.5, wageredUsd: undefined }]);
    expect(result.ok && result.duplicatesMerged).toBe(1);
    expect(result.ok && result.skippedBlank).toBe(1);
  });

  it("explains missing columns", () => {
    const result = parseWagerFile("name,score\nbob,1", "csv");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]).toMatch(/wager column/);
  });

  it("rejects the whole file and lists bad rows", () => {
    const result = parseWagerFile("user,wagered\nok,1\nneg,-5\nnan,lots\n,4\n", "csv");
    expect(result).toEqual({
      ok: false,
      errors: [
        "Line 3: wagered SOL can't be negative",
        "Line 4: wagered SOL is not a number",
        "Line 5: username is empty",
      ],
    });
  });

  it("strips control characters from usernames", () => {
    const result = parseWagerFile("user,wagered\n\"bad\u0007name\",1", "csv");
    expect(result.ok && result.rows[0].username).toBe("badname");
  });
});

describe("parseWagerFile (JSON)", () => {
  it("accepts an array of objects", () => {
    const result = parseWagerFile('[{"username":"a","wagered":"1.5"},{"player":"b","wageredSol":2}]', "json");
    expect(result.ok && result.rows.map((r) => [r.username, r.wageredSol])).toEqual([
      ["a", 1.5],
      ["b", 2],
    ]);
  });

  it("accepts an object wrapping the array", () => {
    const result = parseWagerFile('{"entries":[{"user":"a","sol":1}]}', "json");
    expect(result.ok && result.rows).toHaveLength(1);
  });

  it("reports invalid JSON and wrong shapes", () => {
    expect(parseWagerFile("{nope", "json")).toEqual({ ok: false, errors: ["The file isn't valid JSON."] });
    expect(parseWagerFile('{"foo":1}', "json").ok).toBe(false);
    expect(parseWagerFile('[{"username":"a"}]', "json")).toEqual({
      ok: false,
      errors: ["Item 1: wagered SOL is missing"],
    });
  });
});
