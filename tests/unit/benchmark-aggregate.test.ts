import { describe, expect, it } from "vitest";

import { computeAggregate, type RunOutcome } from "@/lib/benchmark/aggregate";

function run(overrides: Partial<RunOutcome>): RunOutcome {
  return { status: "COMPLETED", ...overrides };
}

describe("computeAggregate", () => {
  it("returns null ratios and zero sample size for an empty run set", () => {
    const result = computeAggregate([]);
    expect(result).toEqual({
      visibility: null,
      shareOfVoice: null,
      avgPosition: null,
      sentimentDist: { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
      sampleSize: 0,
      refusedCount: 0,
      failedCount: 0,
    });
  });

  it("computes visibility as mentioned over completed", () => {
    const result = computeAggregate([
      run({ brandMentioned: true, mentionCount: 1 }),
      run({ brandMentioned: true, mentionCount: 1 }),
      run({ brandMentioned: false, mentionCount: 0 }),
      run({ brandMentioned: false, mentionCount: 0 }),
    ]);
    expect(result.visibility).toBe(0.5);
    expect(result.sampleSize).toBe(4);
  });

  it("excludes refused runs from the visibility denominator without dropping them from sampleSize", () => {
    const result = computeAggregate([
      run({ brandMentioned: true, mentionCount: 1 }),
      run({ brandMentioned: false, refused: true }),
      run({ brandMentioned: false, refused: true }),
    ]);
    // Only one non-refused completed run, and it mentioned the brand.
    expect(result.visibility).toBe(1);
    expect(result.refusedCount).toBe(2);
    expect(result.sampleSize).toBe(3);
  });

  it("excludes failed runs entirely from sampleSize and visibility", () => {
    const result = computeAggregate([
      run({ brandMentioned: true, mentionCount: 1 }),
      run({ status: "FAILED" }),
      run({ status: "PENDING" }),
    ]);
    expect(result.failedCount).toBe(1);
    expect(result.sampleSize).toBe(1);
    expect(result.visibility).toBe(1);
  });

  it("computes shareOfVoice across brand and competitor mentions", () => {
    const result = computeAggregate([
      run({
        brandMentioned: true,
        mentionCount: 2,
        competitorMentions: { "comp-1": 1, "comp-2": 1 },
      }),
      run({
        brandMentioned: false,
        mentionCount: 0,
        competitorMentions: { "comp-1": 3 },
      }),
    ]);
    // brand: 2, competitors: 1 + 1 + 3 = 5, total 7 -> 2/7
    expect(result.shareOfVoice).toBeCloseTo(2 / 7);
  });

  it("returns null shareOfVoice when nobody was mentioned at all", () => {
    const result = computeAggregate([
      run({ brandMentioned: false, mentionCount: 0, competitorMentions: {} }),
    ]);
    expect(result.shareOfVoice).toBeNull();
  });

  it("averages position only over runs that mentioned the brand", () => {
    const result = computeAggregate([
      run({ brandMentioned: true, position: 1 }),
      run({ brandMentioned: true, position: 3 }),
      run({ brandMentioned: false, position: null }),
    ]);
    expect(result.avgPosition).toBe(2);
  });

  it("tallies sentiment only over mentioned, non-refused runs", () => {
    const result = computeAggregate([
      run({ brandMentioned: true, sentiment: "POSITIVE" }),
      run({ brandMentioned: true, sentiment: "POSITIVE" }),
      run({ brandMentioned: true, sentiment: "NEGATIVE" }),
      run({ brandMentioned: false, sentiment: "NEUTRAL" }),
      run({ brandMentioned: true, sentiment: "POSITIVE", refused: true }),
    ]);
    expect(result.sentimentDist).toEqual({
      POSITIVE: 2,
      NEUTRAL: 0,
      NEGATIVE: 1,
    });
  });

  it("reports unmeasured (null) visibility rather than 0 when nothing completed", () => {
    const result = computeAggregate([run({ status: "PENDING" })]);
    expect(result.visibility).toBeNull();
    expect(result.sampleSize).toBe(0);
  });
});
