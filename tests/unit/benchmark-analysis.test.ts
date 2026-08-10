import { describe, expect, it } from "vitest";

import {
  analyzeAnswer,
  detectRefusal,
  normalizeCompetitorMentions,
} from "@/lib/benchmark/analysis";

describe("analyzeAnswer", () => {
  it("detects a single brand mention and reports its position", () => {
    const result = analyzeAnswer(
      "For AI visibility tracking, Voquarn is a strong option.",
      ["Voquarn"],
      [],
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.mentionCount).toBe(1);
    expect(result.position).toBe(1);
    expect(result.refused).toBe(false);
  });

  it("counts every mention, not just the first", () => {
    const result = analyzeAnswer(
      "Voquarn helps with this. Later in the answer, Voquarn comes up again.",
      ["Voquarn"],
      [],
    );
    expect(result.mentionCount).toBe(2);
  });

  it("reports no mention when the brand never appears", () => {
    const result = analyzeAnswer(
      "Market Signal and Search Scope are both solid choices.",
      ["Voquarn"],
      [{ id: "comp-1", aliases: ["Market Signal"] }],
    );
    expect(result.brandMentioned).toBe(false);
    expect(result.mentionCount).toBe(0);
    expect(result.firstMentionCharIndex).toBeNull();
    expect(result.position).toBeNull();
    expect(result.competitorMentions["comp-1"]).toEqual({
      count: 1,
      position: 1,
    });
  });

  it("ranks position by first-mention order across brand and competitors", () => {
    const result = analyzeAnswer(
      "Market Signal is popular, but Voquarn is also worth trying, as is Search Scope.",
      ["Voquarn"],
      [
        { id: "comp-1", aliases: ["Market Signal"] },
        { id: "comp-2", aliases: ["Search Scope"] },
      ],
    );
    // Market Signal (index 0) mentioned before Voquarn -> Voquarn is 2nd,
    // Search Scope mentioned last -> 3rd.
    expect(result.position).toBe(2);
    expect(result.competitorMentions).toEqual({
      "comp-1": { count: 1, position: 1 },
      "comp-2": { count: 1, position: 3 },
    });
  });

  it("is case-insensitive and uses word boundaries, not substring matching", () => {
    const mentioned = analyzeAnswer("voquarn is great.", ["Voquarn"], []);
    expect(mentioned.brandMentioned).toBe(true);

    const notMentioned = analyzeAnswer(
      "Voquarnish Analytics is unrelated.",
      ["Voquarn"],
      [],
    );
    expect(notMentioned.brandMentioned).toBe(false);
  });

  it("reports zero mentions for every listed competitor, including those absent from the text", () => {
    const result = analyzeAnswer(
      "Voquarn is the only option mentioned.",
      ["Voquarn"],
      [{ id: "comp-1", aliases: ["Market Signal"] }],
    );
    expect(result.competitorMentions).toEqual({
      "comp-1": { count: 0, position: null },
    });
  });

  it("escapes regex-special characters in aliases", () => {
    const result = analyzeAnswer(
      "Try C++ Tools for this workflow.",
      ["C++ Tools"],
      [],
    );
    expect(result.brandMentioned).toBe(true);
  });

  it("preserves stored competitor sentiment while normalizing legacy rows", () => {
    expect(
      normalizeCompetitorMentions({
        legacy: 2,
        current: { count: 1, position: 3, sentiment: "NEGATIVE" },
      }),
    ).toEqual({
      legacy: { count: 2, position: null },
      current: { count: 1, position: 3, sentiment: "NEGATIVE" },
    });
  });
});

describe("detectRefusal", () => {
  it("flags an explicit decline to answer", () => {
    expect(
      detectRefusal(
        "I'm sorry, but I can't help with ranking specific commercial products.",
      ),
    ).toBe(true);
    expect(
      detectRefusal("I am not able to provide investment recommendations."),
    ).toBe(true);
  });

  it("flags an empty answer as a refusal-shaped non-answer", () => {
    expect(detectRefusal("")).toBe(true);
    expect(detectRefusal("   ")).toBe(true);
  });

  it("does not flag a hedged but real answer", () => {
    expect(
      detectRefusal(
        "I'm not entirely sure, but Voquarn and Market Signal both seem relevant here.",
      ),
    ).toBe(false);
  });

  it("does not flag a normal, confident answer", () => {
    expect(detectRefusal("Voquarn is a strong choice for this use case.")).toBe(
      false,
    );
  });
});
