import { describe, expect, it } from "vitest";

import { computeThreatScore } from "@/lib/scoring/threat-v1";

describe("computeThreatScore", () => {
  it("returns a full-confidence 0 when every component is present but worthless", () => {
    const result = computeThreatScore(
      {
        serpOverlap: 0,
        prominence: 0,
        citationShare: 0,
        authorityProxy: 0,
        freshness: 0,
        backlinks: 0,
      },
      0,
    );
    expect(result.value).toBe(0);
    expect(result.confidence).toBe(1);
  });

  it("returns a full-confidence 100 when every component maxes out", () => {
    const result = computeThreatScore(
      {
        serpOverlap: 1,
        prominence: 1,
        citationShare: 1,
        authorityProxy: 1,
        freshness: 1,
        backlinks: 1,
      },
      10,
    );
    expect(result.value).toBe(100);
    expect(result.confidence).toBe(1);
  });

  it("masks out missing components instead of treating them as zero", () => {
    // Only serpOverlap (35) and prominence (20) present, both maxed —
    // renormalized over 55/100 of the weight, so the score is still 100,
    // not annihilated by the four missing components.
    const result = computeThreatScore({ serpOverlap: 1, prominence: 1 }, 3);
    expect(result.value).toBe(100);
    expect(result.confidence).toBe(0.55);
    expect(result.components.citationShare.value).toBeNull();
    expect(result.components.citationShare.contribution).toBeNull();
  });

  it("reduces confidence, never silently reads as a low score, when evidence is thin", () => {
    const rich = computeThreatScore({ serpOverlap: 0.5 }, 1);
    const thin = computeThreatScore({ serpOverlap: 0.5, prominence: 0.5 }, 1);
    // Same underlying "50% overlap" signal either way — value is identical...
    expect(rich.value).toBe(50);
    expect(thin.value).toBe(50);
    // ...but confidence reflects how much of the total evidence base was used.
    expect(rich.confidence).toBeLessThan(thin.confidence);
  });

  it("is a pure function: identical inputs always produce a byte-identical result", () => {
    const inputs = { serpOverlap: 0.42, prominence: 0.77, citationShare: null };
    const first = computeThreatScore(inputs, 7);
    const second = computeThreatScore(inputs, 7);
    expect(first).toEqual(second);
  });

  it("clamps out-of-range component values into [0, 1] before weighting", () => {
    const result = computeThreatScore({ serpOverlap: 1.5 }, 1);
    expect(result.components.serpOverlap.value).toBe(1);
  });

  it("returns value 0 and confidence 0 when there is no evidence for any component", () => {
    const result = computeThreatScore({}, 0);
    expect(result.value).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("weights components per §7.1: serpOverlap 35, prominence 20, citationShare 15, authorityProxy/freshness/backlinks 10 each", () => {
    const result = computeThreatScore({ serpOverlap: 1 }, 1);
    expect(result.components.serpOverlap.weight).toBe(35);
    expect(result.components.prominence.weight).toBe(20);
    expect(result.components.citationShare.weight).toBe(15);
    expect(result.components.authorityProxy.weight).toBe(10);
    expect(result.components.freshness.weight).toBe(10);
    expect(result.components.backlinks.weight).toBe(10);
    const totalWeight = Object.values(result.components).reduce(
      (sum, component) => sum + component.weight,
      0,
    );
    expect(totalWeight).toBe(100);
  });
});
