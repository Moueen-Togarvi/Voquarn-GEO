import { describe, expect, it } from "vitest";

import {
  buildPromptGenerationMessages,
  fixturePrompts,
  generatedPromptsSchema,
} from "@/lib/prompts/generator";

const input = {
  brand: {
    name: "Voquarn",
    description: "AI visibility tracking for SaaS teams",
    category: "AI search visibility software",
  },
  competitors: [{ name: "Market Signal" }, { name: "Search Scope" }],
  market: { language: "en", country: "US" },
};

describe("buildPromptGenerationMessages", () => {
  it("includes the brand, category, competitors, and market language", () => {
    const messages = buildPromptGenerationMessages(input);

    expect(messages[0]?.content).toContain("balanced spread across four types");
    expect(messages[0]?.content).toContain("Phrase every question in en");
    expect(messages[1]?.content).toContain("Company: Voquarn");
    expect(messages[1]?.content).toContain(
      "Known competitors: Market Signal, Search Scope",
    );
  });

  it("reports no known competitors instead of an empty string", () => {
    const messages = buildPromptGenerationMessages({
      ...input,
      competitors: [],
    });
    expect(messages[1]?.content).toContain("Known competitors: none known");
  });
});

describe("fixturePrompts", () => {
  it("produces a schema-valid, balanced prompt set referencing the brand", () => {
    const result = fixturePrompts(input);
    expect(generatedPromptsSchema.safeParse(result).success).toBe(true);

    const types = new Set(result.prompts.map((prompt) => prompt.type));
    expect(types).toEqual(
      new Set(["CATEGORY", "COMPARISON", "USE_CASE", "BRAND_SPECIFIC"]),
    );
    expect(
      result.prompts.some((prompt) => prompt.text.includes("Voquarn")),
    ).toBe(true);
  });
});
