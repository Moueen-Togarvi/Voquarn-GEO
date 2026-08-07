import {
  scrapeDoErrorSchema,
  scrapeDoSerpResponseSchema,
  type ScrapeDoSerpRequest,
  type ScrapeDoSerpResponse,
} from "@/lib/providers/scrapedo/types";

export const SCRAPEDO_SERP_ENDPOINT =
  "https://api.scrape.do/plugin/google/search";

export function buildScrapeDoSerpUrl(
  request: ScrapeDoSerpRequest,
  token: string,
): URL {
  const url = new URL(SCRAPEDO_SERP_ENDPOINT);
  url.searchParams.set("token", token);
  url.searchParams.set("q", request.query);
  url.searchParams.set("gl", request.countryCode);
  url.searchParams.set("hl", request.languageCode);
  url.searchParams.set("device", request.device);
  url.searchParams.set("start", String(request.start ?? 0));
  return url;
}

/** Client for Scrape.do's structured Google Search plugin. */
export class ScrapeDoClient {
  constructor(private readonly token = process.env.SCRAPEDO_API_TOKEN) {}

  async fetchOrganicSerp(
    request: ScrapeDoSerpRequest,
  ): Promise<ScrapeDoSerpResponse> {
    if (!this.token) {
      throw new Error(
        "SCRAPEDO_API_TOKEN is not configured. SERP hunting is disabled until it is provided.",
      );
    }

    const response = await fetch(buildScrapeDoSerpUrl(request, this.token), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = scrapeDoErrorSchema.safeParse(payload);
      const detail = error.success
        ? (error.data.message ?? error.data.error)
        : null;
      throw new Error(
        `Scrape.do request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : "."}`,
      );
    }

    return scrapeDoSerpResponseSchema.parse(payload);
  }
}
