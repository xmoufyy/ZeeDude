import { ManualProvider } from "./manual";
import { SolpumpApiProvider, solpumpApiConfigFromEnv } from "./solpump-api";
import type { LeaderboardProvider } from "./types";

export { CsvImportProvider } from "./csv-import";
export { ManualProvider } from "./manual";
export { SolpumpApiProvider } from "./solpump-api";
export * from "./types";

/**
 * The provider the cron job refreshes from, picked by DATA_PROVIDER:
 *  - "manual" (default): data comes from admin imports and manual edits.
 *  - "api": pull from the official SolPump API (stub until docs arrive).
 * File imports always go through CsvImportProvider from the admin panel.
 */
export function getConfiguredProvider(env: Record<string, string | undefined> = process.env): LeaderboardProvider {
  const mode = env.DATA_PROVIDER?.trim().toLowerCase() || "manual";
  switch (mode) {
    case "api":
      return new SolpumpApiProvider(solpumpApiConfigFromEnv(env));
    case "manual":
    case "import":
      return new ManualProvider();
    default:
      throw new Error(`Unknown DATA_PROVIDER "${mode}". Use "manual" or "api".`);
  }
}
