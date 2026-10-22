import path from "node:path";
import { describe, expect, it } from "vitest";
import { absoluteSqliteUrl } from "../../../scripts/standalone.mjs";

describe("absoluteSqliteUrl", () => {
  const root = path.resolve("/project");
  const abs = (p: string) => path.resolve(root, "prisma", p).split(path.sep).join("/");

  it("pins every relative SQLite path to the prisma/ folder", () => {
    expect(absoluteSqliteUrl("file:./dev.db", root)).toBe(`file:${abs("dev.db")}`);
    expect(absoluteSqliteUrl("file:dev.db", root)).toBe(`file:${abs("dev.db")}`);
    expect(absoluteSqliteUrl("file:data/dev.db", root)).toBe(`file:${abs("data/dev.db")}`);
    expect(absoluteSqliteUrl("file:../dev.db", root)).toBe(`file:${abs("../dev.db")}`);
  });

  it("keeps URL parameters", () => {
    expect(absoluteSqliteUrl("file:dev.db?connection_limit=1", root)).toBe(`file:${abs("dev.db")}?connection_limit=1`);
  });

  it("leaves absolute paths and non-SQLite URLs alone", () => {
    expect(absoluteSqliteUrl("file:/var/data/dev.db", root)).toBe("file:/var/data/dev.db");
    expect(absoluteSqliteUrl("file:C:/data/dev.db", root)).toBe("file:C:/data/dev.db");
    expect(absoluteSqliteUrl("postgresql://u:p@h/db", root)).toBe("postgresql://u:p@h/db");
  });
});
