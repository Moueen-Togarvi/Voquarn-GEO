import { describe, expect, it } from "vitest";

import { computeQualityScore } from "@/lib/quality/score";

describe("computeQualityScore", () => {
  it("returns 100 with full confidence when every dimension maxes out", () => {
    const result = computeQualityScore({
      intentSatisfaction: 1,
      originalContribution: 1,
      evidenceCoverage: 1,
      completeness: 1,
      brandFit: 1,
      readability: 1,
      internalLinkRelevance: 1,
      policyCompliance: 1,
    });
    expect(result.value).toBe(100);
    expect(result.confidence).toBe(1);
  });

  it("masks out missing dimensions instead of treating them as zero", () => {
    const result = computeQualityScore({ evidenceCoverage: 1 });
    expect(result.value).toBe(100);
    expect(result.confidence).toBe(0.2);
    expect(result.components.readability.value).toBeNull();
  });

  it("weights evidenceCoverage highest at 20, the rest per the strategy document's dimension list", () => {
    const result = computeQualityScore({ evidenceCoverage: 1 });
    expect(result.components.evidenceCoverage.weight).toBe(20);
    expect(result.components.intentSatisfaction.weight).toBe(15);
    expect(result.components.completeness.weight).toBe(15);
    expect(result.components.brandFit.weight).toBe(10);
    expect(result.components.readability.weight).toBe(10);
    expect(result.components.originalContribution.weight).toBe(10);
    expect(result.components.internalLinkRelevance.weight).toBe(10);
    expect(result.components.policyCompliance.weight).toBe(10);
    const total = Object.values(result.components).reduce(
      (sum, c) => sum + c.weight,
      0,
    );
    expect(total).toBe(100);
  });

  it("is a pure function: identical inputs always produce a byte-identical result", () => {
    const inputs = { evidenceCoverage: 0.6, readability: 0.9 };
    expect(computeQualityScore(inputs)).toEqual(computeQualityScore(inputs));
  });

  it("returns 0 value and 0 confidence with no dimensions scored", () => {
    const result = computeQualityScore({});
    expect(result.value).toBe(0);
    expect(result.confidence).toBe(0);
  });
});
