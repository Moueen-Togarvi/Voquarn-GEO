import type { ScrapeDoSerpRequest } from "@/lib/providers/scrapedo/types";

function normalizeLanguageCode(language: string): string {
  return language.trim().toLowerCase().split(/[-_]/)[0] || "en";
}

/** Scrape.do accepts every ISO 3166-1 alpha-2 country through `gl`. */
export function buildSerpRequest(input: {
  keyword: string;
  country: string;
  language: string;
  device: "DESKTOP" | "MOBILE";
}): ScrapeDoSerpRequest {
  const countryCode = input.country.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(countryCode)) {
    throw new Error(
      `Scrape.do requires a two-letter ISO country code; received "${input.country}".`,
    );
  }

  return {
    query: input.keyword,
    countryCode,
    languageCode: normalizeLanguageCode(input.language),
    device: input.device === "MOBILE" ? "mobile" : "desktop",
    start: 0,
  };
}
