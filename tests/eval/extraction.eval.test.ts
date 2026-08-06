import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { analyzeAnswer } from "@/lib/benchmark/analysis";

type AnswerFixture = {
  id: string;
  description: string;
  answerText: string;
  brandAliases: string[];
  competitors: { id: string; aliases: string[] }[];
  expected: {
    brandMentioned: boolean;
    mentionCount: number;
    refused: boolean;
    competitorMentions: Record<string, number>;
  };
};

const FIXTURES_DIR = path.join(process.cwd(), "tests/fixtures/answers");

// Precision/recall must not fall below this on the hand-labelled golden set.
// A drop here means analyzeAnswer's behavior changed in a way that shifts
// results for previously-analyzed answers — see A6 in the implementation
// plan and docs/benchmark-protocol.md.
const MIN_PRECISION = 0.95;
const MIN_RECALL = 0.95;

function loadFixtures(): AnswerFixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map(
      (file) =>
        JSON.parse(
          readFileSync(path.join(FIXTURES_DIR, file), "utf-8"),
        ) as AnswerFixture,
    );
}

describe("eval: analyzeAnswer extraction", () => {
  const fixtures = loadFixtures();

  it("has a non-trivial golden set", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(6);
  });

  it("matches expected output for every golden fixture", () => {
    const mismatches: string[] = [];

    for (const fixture of fixtures) {
      const result = analyzeAnswer(
        fixture.answerText,
        fixture.brandAliases,
        fixture.competitors,
      );

      if (result.brandMentioned !== fixture.expected.brandMentioned) {
        mismatches.push(
          `${fixture.id}: brandMentioned expected ${fixture.expected.brandMentioned}, got ${result.brandMentioned}`,
        );
      }
      if (result.mentionCount !== fixture.expected.mentionCount) {
        mismatches.push(
          `${fixture.id}: mentionCount expected ${fixture.expected.mentionCount}, got ${result.mentionCount}`,
        );
      }
      if (result.refused !== fixture.expected.refused) {
        mismatches.push(
          `${fixture.id}: refused expected ${fixture.expected.refused}, got ${result.refused}`,
        );
      }
      for (const [competitorId, expectedCount] of Object.entries(
        fixture.expected.competitorMentions,
      )) {
        const actual = result.competitorMentions[competitorId] ?? 0;
        if (actual !== expectedCount) {
          mismatches.push(
            `${fixture.id}: competitor ${competitorId} expected ${expectedCount}, got ${actual}`,
          );
        }
      }
    }

    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  it("meets the brandMentioned precision/recall threshold across the golden set", () => {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const fixture of fixtures) {
      const result = analyzeAnswer(
        fixture.answerText,
        fixture.brandAliases,
        fixture.competitors,
      );
      const predicted = result.brandMentioned;
      const expected = fixture.expected.brandMentioned;

      if (predicted && expected) truePositives += 1;
      else if (predicted && !expected) falsePositives += 1;
      else if (!predicted && expected) falseNegatives += 1;
    }

    const precision =
      truePositives + falsePositives > 0
        ? truePositives / (truePositives + falsePositives)
        : 1;
    const recall =
      truePositives + falseNegatives > 0
        ? truePositives / (truePositives + falseNegatives)
        : 1;

    expect(precision).toBeGreaterThanOrEqual(MIN_PRECISION);
    expect(recall).toBeGreaterThanOrEqual(MIN_RECALL);
  });
});
