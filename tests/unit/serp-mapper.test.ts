import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { mapSerpResponse } from "@/lib/providers/dataforseo/mapper";
import { serpLiveResponseSchema } from "@/lib/providers/dataforseo/types";

function loadFixture(name: string) {
  const raw = readFileSync(
    path.join(process.cwd(), "tests/fixtures/serp", name),
    "utf-8",
  );
  return serpLiveResponseSchema.parse(JSON.parse(raw));
}

describe("mapSerpResponse", () => {
  it("maps organic results with position, domain, and registrable domain", () => {
    const response = loadFixture("organic-with-ai-overview.json");
    const { results } = mapSerpResponse(response);

    const organic = results.filter((result) => result.type === "ORGANIC");
    expect(organic).toHaveLength(2);

    const marketSignal = organic.find(
      (result) => result.domain === "market-signal.example",
    );
    expect(marketSignal).toMatchObject({
      position: 2,
      registrableDomain: "market-signal.example",
      title: "Market Signal — AI Visibility Platform",
    });
  });

  it("collapses a multi-part public suffix to its registrable domain", () => {
    const response = loadFixture("organic-with-ai-overview.json");
    const { results } = mapSerpResponse(response);

    const ukResult = results.find(
      (result) => result.domain === "shop.example.co.uk",
    );
    expect(ukResult?.registrableDomain).toBe("example.co.uk");
  });

  it("expands an AI Overview block into one result per reference, sharing its block position", () => {
    const response = loadFixture("organic-with-ai-overview.json");
    const { results } = mapSerpResponse(response);

    const aiOverview = results.filter(
      (result) => result.type === "AI_OVERVIEW",
    );
    expect(aiOverview).toHaveLength(2);
    expect(aiOverview.every((result) => result.position === 1)).toBe(true);
    expect(aiOverview.map((result) => result.domain).sort()).toEqual(
      ["market-signal.example", "voquarn.com"].sort(),
    );
  });

  it("expands a People Also Ask block's resolved sub-questions into PAA results", () => {
    const response = loadFixture("organic-with-ai-overview.json");
    const { results } = mapSerpResponse(response);

    const paa = results.filter((result) => result.type === "PAA");
    expect(paa).toHaveLength(1);
    expect(paa[0]).toMatchObject({
      position: 3,
      domain: "search-scope.example",
      title: "What is AI visibility?",
    });
  });

  it("reports resultCount from the response's items_count", () => {
    const response = loadFixture("organic-with-ai-overview.json");
    const { resultCount } = mapSerpResponse(response);
    expect(resultCount).toBe(4);
  });

  it("returns an empty result set for a response with no tasks", () => {
    const empty = mapSerpResponse(
      serpLiveResponseSchema.parse({
        status_code: 20000,
        status_message: "Ok.",
      }),
    );
    expect(empty.results).toEqual([]);
    expect(empty.resultCount).toBe(0);
  });
});
