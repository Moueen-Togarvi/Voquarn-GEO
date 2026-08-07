import { registrableDomain } from "@/lib/domains/canonical";
import type { ScrapeDoSerpResponse } from "@/lib/providers/scrapedo/types";

export type MappedSerpResult = {
  position: number;
  url: string;
  domain: string;
  registrableDomain: string;
  title: string | null;
  snippet: string | null;
  type: "ORGANIC" | "AI_OVERVIEW" | "PAA" | "VIDEO" | "LOCAL";
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function mappedResult(input: {
  position: number;
  url: string;
  title?: string | null;
  snippet?: string | null;
  type: MappedSerpResult["type"];
}): MappedSerpResult | null {
  const domain = domainOf(input.url);
  if (!domain) return null;
  return {
    position: input.position,
    url: input.url,
    domain,
    registrableDomain: registrableDomain(domain),
    title: input.title ?? null,
    snippet: input.snippet ?? null,
    type: input.type,
  };
}

/**
 * Converts Scrape.do's categorized response to the provider-neutral rows the
 * hunt persists. PAA and local cards are intentionally not guessed into rows:
 * Scrape.do's documented shapes do not guarantee a source URL for them.
 */
export function mapSerpResponse(response: ScrapeDoSerpResponse): {
  results: MappedSerpResult[];
  resultCount: number;
} {
  const results: MappedSerpResult[] = [];

  for (const item of response.organic_results) {
    const mapped = mappedResult({
      position: item.position,
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      type: "ORGANIC",
    });
    if (mapped) results.push(mapped);
  }

  for (const item of response.video_results) {
    const mapped = mappedResult({
      position: item.position,
      url: item.url,
      title: item.title,
      type: "VIDEO",
    });
    if (mapped) results.push(mapped);
  }

  if (response.ai_overview?.state === "complete") {
    for (const reference of response.ai_overview.references) {
      const mapped = mappedResult({
        position: 1,
        url: reference.link,
        title: reference.title,
        snippet: reference.snippet,
        type: "AI_OVERVIEW",
      });
      if (mapped) results.push(mapped);
    }
  }

  return { results, resultCount: results.length };
}
