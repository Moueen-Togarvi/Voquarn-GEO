import { describe, expect, it } from "vitest";

import {
  normalizeCitationShare,
  normalizeProminence,
  normalizeSerpOverlap,
} from "@/lib/scoring/normalize";

describe("normalizeSerpOverlap", () => {
  it("computes the fraction of tracked keywords a competitor appears in", () => {
    expect(normalizeSerpOverlap(3, 10)).toBe(0.3);
    expect(normalizeSerpOverlap(10, 10)).toBe(1);
    expect(normalizeSerpOverlap(0, 10)).toBe(0);
  });

  it("returns null when there are no tracked keywords, not zero", () => {
    expect(normalizeSerpOverlap(0, 0)).toBeNull();
  });
});

describe("normalizeProminence", () => {
  it("scores position 1 as 1 and the worst-considered position as 0", () => {
    expect(normalizeProminence([1], 20)).toBe(1);
    expect(normalizeProminence([20], 20)).toBe(0);
  });

  it("clamps positions beyond the worst-considered rank to 0", () => {
    expect(normalizeProminence([50], 20)).toBe(0);
  });

  it("averages across multiple positions", () => {
    // position 1 -> 1, position 20 -> 0
    expect(normalizeProminence([1, 20], 20)).toBe(0.5);
  });

  it("returns null for an empty position list, not zero", () => {
    expect(normalizeProminence([])).toBeNull();
  });
});

describe("normalizeCitationShare", () => {
  it("computes the competitor's share of tracked-brand mentions", () => {
    expect(normalizeCitationShare(3, 1)).toBe(0.75);
    expect(normalizeCitationShare(0, 5)).toBe(0);
  });

  it("returns null when nobody was mentioned at all", () => {
    expect(normalizeCitationShare(0, 0)).toBeNull();
  });
});
