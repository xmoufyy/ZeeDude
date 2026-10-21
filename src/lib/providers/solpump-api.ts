import { z } from "zod";
import { ProviderError, toProviderEntries, type LeaderboardProvider, type ProviderEntry, type ProviderPeriod } from "./types";

// Official SolPump affiliate/partner API: STUB.
//
// We don't have API docs or credentials yet, so this provider refuses to run
// until it's finished. Do NOT point it at SolPump's private site endpoints:
// only an official, documented partner API is acceptable.
//
// To finish it once docs arrive:
//   1. Set SOLPUMP_API_URL and SOLPUMP_API_KEY (and DATA_PROVIDER=api).
//   2. Fill in `request()` with the documented endpoint, auth header and
//      date parameters.
//   3. Replace `responseSchema` with the documented response shape and map it
//      in `fetchEntries()`.
//   4. Set IMPLEMENTED to true and add a test with a recorded sample response.

const IMPLEMENTED = false;
const TIMEOUT_MS = 15_000;

// Placeholder shape until the real API docs are available.
const responseSchema = z.object({
  players: z.array(
    z.object({
      username: z.string().min(1).max(64),
      wageredSol: z.number().nonnegative(),
      wageredUsd: z.number().nonnegative().optional(),
    }),
  ),
});

export type SolpumpApiConfig = { baseUrl: string; apiKey: string };

export function solpumpApiConfigFromEnv(env: Record<string, string | undefined> = process.env): SolpumpApiConfig | null {
  const baseUrl = env.SOLPUMP_API_URL?.trim();
  const apiKey = env.SOLPUMP_API_KEY?.trim();
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

export class SolpumpApiProvider implements LeaderboardProvider {
  readonly kind = "api" as const;
  readonly pull = true;

  constructor(
    private readonly config: SolpumpApiConfig | null,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fetchEntries(period: ProviderPeriod): Promise<ProviderEntry[]> {
    if (!this.config) {
      throw new ProviderError("SolPump API isn't configured. Set SOLPUMP_API_URL and SOLPUMP_API_KEY.");
    }
    if (!IMPLEMENTED) {
      throw new ProviderError(
        "The SolPump API provider is a stub until official partner API docs are available. Use file import or manual entry.",
      );
    }

    const body = await this.request(period);
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success) {
      throw new ProviderError("SolPump API returned data in an unexpected shape.", parsed.error.issues.map((i) => i.message));
    }
    return toProviderEntries(parsed.data.players);
  }

  private async request(period: ProviderPeriod): Promise<unknown> {
    // TODO(api-docs): replace with the documented endpoint and parameters.
    const url = new URL(this.config!.baseUrl);
    url.searchParams.set("from", period.startsAt.toISOString());
    url.searchParams.set("to", period.endsAt.toISOString());

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${this.config!.apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      throw new ProviderError(`Couldn't reach the SolPump API: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new ProviderError(`SolPump API responded with HTTP ${response.status}.`);
    return response.json();
  }
}
