import { describe, expect, it } from "vitest";

import { computeOpportunityScore } from "@/lib/opportunity/score";

describe("computeOpportunityScore", () => {
  it("returns 100 with full confidence when every component maxes out", () => {
    const result = computeOpportunityScore({
      gapSeverity: 1,
      competitiveCoverage: 1,
      keywordPriority: 1,
      evidenceStrength: 1,
      citationPressure: 1,
    });
    expect(result.value).toBe(100);
    expect(result.confidence).toBe(1);
  });

  it("masks out missing components instead of treating them as zero", () => {
    // Only gapSeverity (40) and competitiveCoverage (25) present, both maxed
    // — renormalized over 65/100 of the weight, so the score is still 100.
    const result = computeOpportunityScore({
      gapSeverity: 1,
      competitiveCoverage: 1,
    });
    expect(result.value).toBe(100);
    expect(result.confidence).toBe(0.65);
    expect(result.components.citationPressure.value).toBeNull();
    expect(result.components.citationPressure.contribution).toBeNull();
  });

  it("weights components per the plan's A1 #2 correction: gapSeverity 40, competitiveCoverage 25, keywordPriority 15, evidenceStrength/citationPressure 10 each", () => {
    const result = computeOpportunityScore({ gapSeverity: 1 });
    expect(result.components.gapSeverity.weight).toBe(40);
    expect(result.components.competitiveCoverage.weight).toBe(25);
    expect(result.components.keywordPriority.weight).toBe(15);
    expect(result.components.evidenceStrength.weight).toBe(10);
    expect(result.components.citationPressure.weight).toBe(10);
    const totalWeight = Object.values(result.components).reduce(
      (sum, component) => sum + component.weight,
      0,
    );
    expect(totalWeight).toBe(100);
  });

  it("is a pure function: identical inputs always produce a byte-identical result", () => {
    const inputs = {
      gapSeverity: 0.6,
      competitiveCoverage: null,
      keywordPriority: 1 / 3,
    };
    expect(computeOpportunityScore(inputs)).toEqual(
      computeOpportunityScore(inputs),
    );
  });

  it("returns 0 value and 0 confidence with no evidence at all", () => {
    const result = computeOpportunityScore({});
    expect(result.value).toBe(0);
    expect(result.confidence).toBe(0);
  });
});
