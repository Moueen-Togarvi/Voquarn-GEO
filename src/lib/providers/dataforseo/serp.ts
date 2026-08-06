import type { SerpLiveRequest } from "@/lib/providers/dataforseo/types";

/**
 * DataForSEO reuses Google Ads' geotargeting location criteria IDs. This is
 * a small, explicit table for the beta persona's likely markets rather than
 * a guess at the full list — DataForSEO also publishes a
 * `/v3/serp/google/locations` endpoint that should replace this with a
 * dynamic, cached lookup once more markets are needed. Failing closed with a
 * clear error for an unmapped country is safer than silently fetching the
 * wrong country's SERP.
 */
const LOCATION_CODES: Record<string, number> = {
  US: 2840,
  GB: 2826,
  CA: 2124,
  AU: 2036,
  DE: 2276,
  FR: 2250,
  IN: 2356,
  IE: 2372,
};

export function resolveLocationCode(countryCode: string): number {
  const code = LOCATION_CODES[countryCode.toUpperCase()];
  if (!code) {
    throw new Error(
      `No DataForSEO location code mapped for country "${countryCode}". Add it to LOCATION_CODES in src/lib/providers/dataforseo/serp.ts.`,
    );
  }
  return code;
}

export function buildSerpRequest(input: {
  keyword: string;
  country: string;
  language: string;
  device: "DESKTOP" | "MOBILE";
}): SerpLiveRequest {
  return {
    keyword: input.keyword,
    locationCode: resolveLocationCode(input.country),
    languageCode: input.language,
    device: input.device === "MOBILE" ? "mobile" : "desktop",
  };
}
