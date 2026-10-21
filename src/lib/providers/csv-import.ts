import { parseWagerFile } from "../import";
import { ProviderError, toProviderEntries, type LeaderboardProvider, type ProviderEntry } from "./types";

/** Wager data from a CSV or JSON file an admin uploads or pastes. */
export class CsvImportProvider implements LeaderboardProvider {
  readonly kind = "import" as const;
  readonly pull = false;
  /** Set after a successful fetch; useful for telling the admin what happened. */
  stats = { duplicatesMerged: 0, skippedBlank: 0 };

  constructor(
    private readonly text: string,
    readonly format: "csv" | "json",
  ) {}

  async fetchEntries(): Promise<ProviderEntry[]> {
    const parsed = parseWagerFile(this.text, this.format);
    if (!parsed.ok) throw new ProviderError("Nothing was imported. Fix these problems and try again:", parsed.errors);
    this.stats = { duplicatesMerged: parsed.duplicatesMerged, skippedBlank: parsed.skippedBlank };
    return toProviderEntries(parsed.rows);
  }
}
