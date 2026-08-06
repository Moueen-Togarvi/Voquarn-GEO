import {
  serpLiveResponseSchema,
  type SerpLiveRequest,
  type SerpLiveResponse,
} from "@/lib/providers/dataforseo/types";

export const DATAFORSEO_SERP_ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

/**
 * DataForSEO uses HTTP Basic auth (login:password), not a bearer token —
 * see https://docs.dataforseo.com/v3/auth/. This client is structurally
 * complete against DataForSEO's documented request/response shape but has
 * never been exercised against the live API in this environment (no
 * credentials available here) — verify against a real response before
 * relying on it in production, same caveat as the mapper it feeds.
 */
export class DataForSeoClient {
  constructor(
    private readonly login = process.env.DATAFORSEO_LOGIN,
    private readonly password = process.env.DATAFORSEO_PASSWORD,
  ) {}

  async fetchOrganicSerp(request: SerpLiveRequest): Promise<SerpLiveResponse> {
    if (!this.login || !this.password) {
      throw new Error(
        "DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD are not configured. SERP hunting is disabled until both are provided.",
      );
    }

    const auth = Buffer.from(`${this.login}:${this.password}`).toString(
      "base64",
    );

    const response = await fetch(DATAFORSEO_SERP_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword: request.keyword,
          location_code: request.locationCode,
          language_code: request.languageCode,
          device: request.device,
          depth: request.depth ?? 20,
        },
      ]),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(
        `DataForSEO request failed (${response.status} ${response.statusText}).`,
      );
    }

    const payload: unknown = await response.json();
    const parsed = serpLiveResponseSchema.parse(payload);

    if (parsed.status_code !== 20000) {
      throw new Error(`DataForSEO task failed: ${parsed.status_message}`);
    }

    return parsed;
  }
}
