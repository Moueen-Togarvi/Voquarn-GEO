import { describe, expect, it } from "vitest";

import { buildDedupeKey } from "@/lib/opportunity/dedupe";

describe("buildDedupeKey", () => {
  it("is deterministic for the same inputs", () => {
    const a = buildDedupeKey("MISSING_COVERAGE", { topicId: "topic_1" });
    const b = buildDedupeKey("MISSING_COVERAGE", { topicId: "topic_1" });
    expect(a).toBe(b);
  });

  it("differs by kind", () => {
    const a = buildDedupeKey("MISSING_COVERAGE", { topicId: "topic_1" });
    const b = buildDedupeKey("WEAK_COVERAGE", { topicId: "topic_1" });
    expect(a).not.toBe(b);
  });

  it("differs by topic, competitor, and keyword independently", () => {
    const base = buildDedupeKey("COMPARISON", {
      topicId: "topic_1",
      competitorId: "competitor_1",
    });
    expect(
      buildDedupeKey("COMPARISON", {
        topicId: "topic_2",
        competitorId: "competitor_1",
      }),
    ).not.toBe(base);
    expect(
      buildDedupeKey("COMPARISON", {
        topicId: "topic_1",
        competitorId: "competitor_2",
      }),
    ).not.toBe(base);
  });

  it("treats missing parts consistently regardless of undefined vs. null", () => {
    const a = buildDedupeKey("CITATION_GAP", { competitorId: "competitor_1" });
    const b = buildDedupeKey("CITATION_GAP", {
      competitorId: "competitor_1",
      topicId: null,
      keywordId: undefined,
    });
    expect(a).toBe(b);
  });
});
