// Helpers for running the Next.js standalone build (output: "standalone").

import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

export const STANDALONE_DIR = ".next/standalone";

/**
 * Standalone output doesn't include public/ or .next/static/ (they're meant
 * for a CDN). Copy them next to server.js so it can serve them itself.
 */
export function prepareStandalone(root = process.cwd()) {
  const standalone = path.join(root, STANDALONE_DIR);
  if (!existsSync(path.join(standalone, "server.js"))) {
    throw new Error(`No ${STANDALONE_DIR}/server.js. Run \`npm run build\` first.`);
  }
  for (const [from, to] of [
    ["public", "public"],
    [".next/static", ".next/static"],
  ]) {
    const target = path.join(standalone, to);
    rmSync(target, { recursive: true, force: true });
    cpSync(path.join(root, from), target, { recursive: true });
  }
  return standalone;
}

/**
 * Prisma resolves a relative SQLite path (file:./dev.db) against the schema
 * folder, which moves once server.js runs from .next/standalone. Pin it to
 * the project's prisma/ folder instead. Other URLs pass through unchanged.
 */
export function absoluteSqliteUrl(url, root = process.cwd()) {
  // Any relative path (file:dev.db, file:./dev.db, file:../x.db), keeping ?params.
  const match = /^file:(?!\/|[A-Za-z]:)([^?]+)(\?.*)?$/.exec(url ?? "");
  if (!match) return url;
  return `file:${path.resolve(root, "prisma", match[1]).replace(/\\/g, "/")}${match[2] ?? ""}`;
}
