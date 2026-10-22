import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFallbackStore } from "../fallback";
import { assessFreshness, DEFAULT_STALE_AFTER_MS, staleAfterMs } from "../freshness";

describe("assessFreshness", () => {
  const now = Date.parse("2026-10-21T20:00:00Z");
  const base = {
    now,
    fromFallback: false,
    live: true,
    dataUpdatedAt: "2026-10-21T19:00:00Z",
    source: null,
    staleAfterMs: DEFAULT_STALE_AFTER_MS,
  };

  it("is fresh in the normal case", () => {
    expect(assessFreshness(base)).toEqual({ delayed: false });
  });

  it("flags data served from the fallback copy", () => {
    expect(assessFreshness({ ...base, fromFallback: true, fallbackSavedAt: "2026-10-21T18:00:00Z" })).toEqual({
      delayed: true,
      reason: "database",
      since: "2026-10-21T18:00:00Z",
    });
  });

  it("flags a pulled source whose latest run failed", () => {
    const source = { pull: true, lastSuccessAt: "2026-10-21T19:00:00Z", lastErrorAt: "2026-10-21T19:50:00Z" };
    expect(assessFreshness({ ...base, source })).toMatchObject({ delayed: true, reason: "source" });
  });

  it("clears the source warning once a later run succeeds", () => {
    const source = { pull: true, lastSuccessAt: "2026-10-21T19:55:00Z", lastErrorAt: "2026-10-21T19:50:00Z" };
    expect(assessFreshness({ ...base, source })).toEqual({ delayed: false });
  });

  it("ignores source errors for push providers (imports)", () => {
    const source = { pull: false, lastSuccessAt: null, lastErrorAt: "2026-10-21T19:50:00Z" };
    expect(assessFreshness({ ...base, source })).toEqual({ delayed: false });
  });

  it("flags live data older than the stale threshold, but not finished periods", () => {
    const old = { ...base, dataUpdatedAt: "2026-10-19T00:00:00Z" };
    expect(assessFreshness(old)).toMatchObject({ delayed: true, reason: "stale" });
    expect(assessFreshness({ ...old, live: false })).toEqual({ delayed: false });
  });

  it("reads the stale threshold from env", () => {
    expect(staleAfterMs({ DATA_STALE_AFTER_MINUTES: "90" })).toBe(90 * 60_000);
    expect(staleAfterMs({ DATA_STALE_AFTER_MINUTES: "nope" })).toBe(DEFAULT_STALE_AFTER_MS);
  });
});

describe("fallback store", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "zd-fallback-"));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("passes through successful loads", async () => {
    const store = createFallbackStore(dir);
    expect(await store.withFallback("k", async () => ({ n: 1 }))).toEqual({ value: { n: 1 }, fromFallback: false });
  });

  it("serves the last good value when a load fails", async () => {
    const store = createFallbackStore(dir);
    await store.withFallback("k", async () => ({ n: 1 }));
    const result = await store.withFallback("k", async () => {
      throw new Error("db down");
    });
    expect(result).toMatchObject({ value: { n: 1 }, fromFallback: true });
  });

  it("survives a restart by reading the copy on disk", async () => {
    await createFallbackStore(dir).withFallback("k", async () => ["saved"]);
    const fresh = createFallbackStore(dir); // new process, empty memory
    const result = await fresh.withFallback("k", async () => {
      throw new Error("db down");
    });
    expect(result).toMatchObject({ value: ["saved"], fromFallback: true });
  });

  it("rethrows when there's nothing saved yet", async () => {
    const store = createFallbackStore(dir);
    await expect(
      store.withFallback("never", async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
  });

  it("keeps keys separate and safe as file names", async () => {
    const store = createFallbackStore(dir);
    await store.withFallback("period-../../etc", async () => 1);
    await store.withFallback("other", async () => 2);
    store.clearMemory();
    const fail = async () => {
      throw new Error("x");
    };
    expect((await store.withFallback("period-../../etc", fail)).value).toBe(1);
    expect((await store.withFallback("other", fail)).value).toBe(2);
  });
});

describe("fallback store rethrow hook", () => {
  it("lets framework control-flow errors through instead of serving the fallback", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "zd-fallback-"));
    const control = new Error("prerender aborted");
    const store = createFallbackStore(dir, {
      rethrow: (e) => {
        if (e === control) throw e;
      },
    });
    await store.withFallback("k", async () => 1);
    await expect(
      store.withFallback("k", async () => {
        throw control;
      }),
    ).rejects.toBe(control);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("fallback sanitizing (privacy fails closed)", () => {
  const board = (names: string[]) => ({ masked: false, rows: names.map((name) => ({ name, rank: 1 })) });
  type Board = ReturnType<typeof board>;
  const dbDown = async (): Promise<Board> => {
    throw new Error("db down");
  };

  it("stores and serves masked names even when the live board showed full names", async () => {
    const { maskBoardForFallback } = await import("../fallback-sanitize");
    const dir = await mkdtemp(path.join(tmpdir(), "zd-fallback-"));
    const store = createFallbackStore(dir);
    const live = await store.withFallback("b", async () => board(["SolSurfer", "Ze****an"]), maskBoardForFallback);
    expect(live.value.rows.map((r) => r.name)).toEqual(["SolSurfer", "Ze****an"]); // live result untouched

    store.clearMemory(); // force the disk copy
    const served = await store.withFallback(
      "b",
      dbDown,
      maskBoardForFallback,
    );
    expect(served.fromFallback).toBe(true);
    expect(served.value.rows.map((r) => r.name)).toEqual(["So****er", "Ze****an"]);
    expect(served.value.masked).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it("masks copies saved before sanitizing existed", async () => {
    const { maskBoardForFallback } = await import("../fallback-sanitize");
    const dir = await mkdtemp(path.join(tmpdir(), "zd-fallback-"));
    await createFallbackStore(dir).withFallback("old", async () => board(["SolSurfer"])); // saved raw
    const served = await createFallbackStore(dir).withFallback(
      "old",
      dbDown,
      maskBoardForFallback,
    );
    expect(served.value.rows[0].name).toBe("So****er");
    await rm(dir, { recursive: true, force: true });
  });

  it("leaves a null board alone", async () => {
    const { maskBoardForFallback } = await import("../fallback-sanitize");
    expect(maskBoardForFallback(null)).toBeNull();
  });
});
