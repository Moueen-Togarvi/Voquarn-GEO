import type { ScrapeDoSerpResponse } from "@/lib/providers/scrapedo/types";

/** Deterministic, network-free SERP response used by Playwright. */
export function shouldUseHuntFixture(): boolean {
  return process.env.E2E_DISCOVERY_FIXTURE === "true";
}

export function fixtureSerpResponse(keyword: string): ScrapeDoSerpResponse {
  return {
    search_parameters: { q: keyword, gl: "us", hl: "en", device: "desktop" },
    search_information: { total_results: 2 },
    organic_results: [
      {
        position: 1,
        title: "Market Signal",
        snippet: "A fixture competitor result.",
        link: "https://market-signal.example/",
      },
      {
        position: 2,
        title: "Search Scope",
        snippet: "Another fixture competitor result.",
        link: "https://search-scope.example/",
      },
    ],
    video_results: [],
    ai_overview: null,
  };
}
