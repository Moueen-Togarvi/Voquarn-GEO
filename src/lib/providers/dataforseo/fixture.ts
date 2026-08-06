import type { SerpLiveResponse } from "@/lib/providers/dataforseo/types";

/** Deterministic, network-free SERP response used by Playwright — see E2E_DISCOVERY_FIXTURE in src/lib/discovery/brand-profile.ts, reused here for the same reason. */
export function shouldUseHuntFixture(): boolean {
  return process.env.E2E_DISCOVERY_FIXTURE === "true";
}

export function fixtureSerpResponse(keyword: string): SerpLiveResponse {
  return {
    status_code: 20000,
    status_message: "Ok.",
    tasks: [
      {
        id: "fixture-task",
        status_code: 20000,
        status_message: "Ok.",
        result: [
          {
            keyword,
            items_count: 2,
            items: [
              {
                type: "organic",
                rank_absolute: 1,
                domain: "market-signal.example",
                title: "Market Signal",
                description: "A fixture competitor result.",
                url: "https://market-signal.example/",
              },
              {
                type: "organic",
                rank_absolute: 2,
                domain: "search-scope.example",
                title: "Search Scope",
                description: "Another fixture competitor result.",
                url: "https://search-scope.example/",
              },
            ],
          },
        ],
      },
    ],
  };
}
