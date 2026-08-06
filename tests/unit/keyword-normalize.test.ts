import { describe, expect, it } from "vitest";

import { normalizeKeyword } from "@/lib/keywords/normalize";

describe("normalizeKeyword", () => {
  it("lowercases and trims", () => {
    expect(normalizeKeyword("  Project Management Software  ")).toBe(
      "project management software",
    );
  });

  it("collapses internal whitespace", () => {
    expect(normalizeKeyword("project   management\tsoftware")).toBe(
      "project management software",
    );
  });

  it("makes visually distinct inputs collide when they mean the same keyword", () => {
    expect(normalizeKeyword("Project Management Software")).toBe(
      normalizeKeyword("project   management software"),
    );
  });

  it("applies NFKC normalization", () => {
    // U+FF21 fullwidth "A" normalizes to U+0041 "A" under NFKC.
    expect(normalizeKeyword("ＡI tools")).toBe(normalizeKeyword("AI tools"));
  });
});
