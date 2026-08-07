import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { qualityJudgeSchema } from "@/lib/quality/rubric";

/**
 * Companion to tests/eval/extraction.eval.test.ts (A6 in the implementation
 * plan) — but the thing being scored here (the LLM judge) has no pure
 * deterministic implementation to test directly, unlike analyzeAnswer().
 * Fixture expectedRanges below are this agent's own best-effort initial
 * calibration, NOT a human-reviewer-labelled set — per the plan, "LLM-as-
 * judge with a fixed rubric is acceptable only if calibrated against a
 * human-labelled set." Replace these ranges with real reviewer judgments
 * before trusting this gate in CI; until then it exists to catch gross
 * regressions (a "weak" draft scored as strong, or vice versa), not to
 * assert precise calibration.
 */

type QualityDraftFixture = {
  id: string;
  description: string;
  title: string;
  brandName: string;
  brandTone: string;
  outline: unknown;
  plainText: string;
  expectedRanges: Record<string, [number, number]>;
};

const FIXTURES_DIR = path.join(process.cwd(), "tests/fixtures/quality-drafts");

function loadFixtures(): QualityDraftFixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map(
      (file) =>
        JSON.parse(
          readFileSync(path.join(FIXTURES_DIR, file), "utf-8"),
        ) as QualityDraftFixture,
    );
}

describe("quality draft fixtures", () => {
  it("are well-formed even without a live LLM call", () => {
    const fixtures = loadFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(2);
    for (const fixture of fixtures) {
      expect(fixture.plainText.length).toBeGreaterThan(20);
      expect(Object.keys(fixture.expectedRanges).length).toBeGreaterThan(0);
      for (const [min, max] of Object.values(fixture.expectedRanges)) {
        expect(min).toBeGreaterThanOrEqual(0);
        expect(max).toBeLessThanOrEqual(1);
        expect(min).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe.skipIf(!process.env.OPENAI_API_KEY)(
  "quality judge (live, nightly only)",
  () => {
    it.each(loadFixtures())(
      "scores $id within the expected range on every asserted dimension",
      async (fixture) => {
        const { OpenAiProvider } = await import("@/lib/llm/openai");
        const { buildQualityJudgeMessages } =
          await import("@/lib/quality/rubric");

        const provider = new OpenAiProvider();
        const result = await provider.generateJson({
          messages: buildQualityJudgeMessages({
            title: fixture.title,
            plainText: fixture.plainText,
            brandName: fixture.brandName,
            brandTone: fixture.brandTone,
            outline: fixture.outline,
          }),
          schema: qualityJudgeSchema,
          temperature: 0.2,
        });

        for (const [dimension, [min, max]] of Object.entries(
          fixture.expectedRanges,
        )) {
          const value = result.content[
            dimension as keyof typeof result.content
          ] as number;
          expect(
            value,
            `${fixture.id}.${dimension} = ${value}, expected [${min}, ${max}]`,
          ).toBeGreaterThanOrEqual(min);
          expect(
            value,
            `${fixture.id}.${dimension} = ${value}, expected [${min}, ${max}]`,
          ).toBeLessThanOrEqual(max);
        }
      },
      30_000,
    );
  },
);
