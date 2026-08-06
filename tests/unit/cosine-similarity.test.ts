import { describe, expect, it } from "vitest";

import { cosineSimilarity } from "@/lib/embeddings/cosine";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 10);
  });

  it("is scale-invariant", () => {
    const a = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    const b = cosineSimilarity([2, 4, 6], [4, 5, 6]);
    expect(b).toBeCloseTo(a, 10);
  });

  it("returns 0 for a zero vector rather than dividing by zero", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("throws on mismatched lengths", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });
});
