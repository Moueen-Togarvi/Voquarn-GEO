import { describe, expect, it } from "vitest";

import { calculateCost, resolveRate } from "@/lib/llm/pricing";

describe("resolveRate", () => {
  it("returns null for an unpriced provider/model pair", () => {
    expect(resolveRate("openai", "gpt-5", new Date("2026-01-01"))).toBeNull();
  });

  it("returns null before the rate's effective date", () => {
    expect(
      resolveRate("openai", "gpt-5.6-sol", new Date("2026-08-06")),
    ).toBeNull();
  });

  it("returns the rate once its effective date has passed", () => {
    const rate = resolveRate("openai", "gpt-5.6-sol", new Date("2026-08-07"));
    expect(rate).not.toBeNull();
    expect(rate?.provider).toBe("openai");
    expect(rate?.currency).toBe("USD");
  });
});

describe("calculateCost", () => {
  it("returns null when no rate is known, rather than fabricating a cost", () => {
    expect(
      calculateCost("openai", "gpt-5", {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      }),
    ).toBeNull();
  });

  it("computes cost from a known rate without throwing", () => {
    const result = calculateCost(
      "openai",
      "gpt-5.6-sol",
      {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      },
      new Date("2026-08-07"),
    );
    expect(result).not.toBeNull();
    expect(result?.currency).toBe("USD");
    expect(result?.costUnits).toBe(35);
  });
});
