import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// Last-known-good copies of public leaderboard data, kept outside the
// database so the site can still show something if the database is down.
// Copies live in memory and on local disk (FALLBACK_CACHE_DIR, default the OS
// temp dir). On serverless hosts disk is per instance, so this covers warm
// instances; the framework's own cache covers the rest.

type Entry<T> = { savedAt: string; json: string; value: T };

export type FallbackResult<T> = { value: T; fromFallback: false } | { value: T; fromFallback: true; savedAt: string };

type Options = {
  /** Rethrows framework control-flow errors (e.g. Next.js prerender aborts) so they aren't mistaken for outages. */
  rethrow?: (error: unknown) => void;
};

export function createFallbackStore(dir: string, { rethrow }: Options = {}) {
  const memory = new Map<string, Entry<unknown>>();
  const fileFor = (key: string) => path.join(dir, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);

  async function persist(key: string, entry: Entry<unknown>) {
    try {
      await mkdir(dir, { recursive: true });
      const file = fileFor(key);
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify({ savedAt: entry.savedAt, value: entry.value }));
      await rename(temp, file); // atomic swap so readers never see half a file
    } catch (error) {
      console.warn(`[fallback] couldn't write ${key}:`, error);
    }
  }

  async function recall<T>(key: string): Promise<Entry<T> | null> {
    const cached = memory.get(key) as Entry<T> | undefined;
    if (cached) return cached;
    try {
      const { savedAt, value } = JSON.parse(await readFile(fileFor(key), "utf8")) as { savedAt: string; value: T };
      return { savedAt, value, json: JSON.stringify(value) };
    } catch {
      return null;
    }
  }

  /** Runs `load`; on success remembers the result, on failure returns the last remembered one. */
  async function withFallback<T>(key: string, load: () => Promise<T>): Promise<FallbackResult<T>> {
    try {
      const value = await load();
      const json = JSON.stringify(value);
      if (memory.get(key)?.json !== json) {
        const entry = { savedAt: new Date().toISOString(), json, value };
        memory.set(key, entry);
        await persist(key, entry);
      }
      return { value, fromFallback: false };
    } catch (error) {
      rethrow?.(error);
      const saved = await recall<T>(key);
      if (!saved) throw error;
      console.error(`[fallback] serving saved "${key}" from ${saved.savedAt} after error:`, error);
      return { value: saved.value, fromFallback: true, savedAt: saved.savedAt };
    }
  }

  return { withFallback, clearMemory: () => memory.clear() };
}

