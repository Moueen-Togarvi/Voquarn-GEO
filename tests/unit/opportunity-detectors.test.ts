import { describe, expect, it } from "vitest";

import { detectComparisonGap } from "@/lib/opportunity/detectors/comparison";
import {
  detectCitationGaps,
  type CitationGapInput,
} from "@/lib/opportunity/detectors/citation-gap";
import { detectIntentMismatch } from "@/lib/opportunity/detectors/intent-mismatch";
import { detectMissingCoverage } from "@/lib/opportunity/detectors/missing-coverage";
import { detectStale } from "@/lib/opportunity/detectors/stale";
import { detectWeakCoverage } from "@/lib/opportunity/detectors/weak-coverage";
import { runTopicDetectors } from "@/lib/opportunity/detectors";
import type {
  CompetitorPageEvidence,
  PageEvidence,
  TopicCoverage,
} from "@/lib/opportunity/types";

function page(overrides: Partial<PageEvidence> = {}): PageEvidence {
  return {
    snapshotId: "snapshot_own",
    url: "https://brand.test/topic",
    title: "Our topic page",
    wordCount: 1000,
    intent: "INFORMATIONAL",
    freshnessConfidence: 0.8,
    publishedAt: "2026-01-01T00:00:00.000Z",
    modifiedAt: "2026-01-01T00:00:00.000Z",
    similarity: 0.9,
    ...overrides,
  };
}

function competitorPage(
  overrides: Partial<CompetitorPageEvidence> = {},
): CompetitorPageEvidence {
  return {
    ...page({
      snapshotId: "snapshot_competitor",
      url: "https://rival.test/topic",
      title: "Rival's topic page",
    }),
    competitorId: "competitor_1",
    competitorName: "Rival Co",
    ...overrides,
  };
}

function coverage(overrides: Partial<TopicCoverage> = {}): TopicCoverage {
  return {
    topicId: "topic_1",
    topicName: "Widget maintenance",
    keywordId: "keyword_1",
    keywordText: "widget maintenance guide",
    keywordIntent: "INFORMATIONAL",
    keywordPriority: "HIGH",
    ownPage: null,
    competitorPages: [],
    totalTrackedCompetitors: 2,
    ...overrides,
  };
}

describe("detectMissingCoverage", () => {
  it("fires when a competitor covers a topic the brand has no page for", () => {
    const gap = detectMissingCoverage(
      coverage({ competitorPages: [competitorPage()] }),
    );
    expect(gap?.kind).toBe("MISSING_COVERAGE");
    expect(gap?.components.gapSeverity).toBe(1);
    expect(gap?.topicId).toBe("topic_1");
  });

  it("does not fire when the brand already has a matching page", () => {
    expect(
      detectMissingCoverage(
        coverage({ ownPage: page(), competitorPages: [competitorPage()] }),
      ),
    ).toBeNull();
  });

  it("does not fire when no competitor covers the topic either", () => {
    expect(detectMissingCoverage(coverage())).toBeNull();
  });
});

describe("detectWeakCoverage", () => {
  it("fires when the brand's page is both proportionally and absolutely thinner", () => {
    const gap = detectWeakCoverage(
      coverage({
        ownPage: page({ wordCount: 300 }),
        competitorPages: [competitorPage({ wordCount: 1200 })],
      }),
    );
    expect(gap?.kind).toBe("WEAK_COVERAGE");
    expect(gap?.components.gapSeverity).toBeGreaterThan(0);
  });

  it("does not fire on a small absolute gap even if proportionally large", () => {
    expect(
      detectWeakCoverage(
        coverage({
          ownPage: page({ wordCount: 100 }),
          competitorPages: [competitorPage({ wordCount: 250 })],
        }),
      ),
    ).toBeNull();
  });

  it("does not fire when there is no own page to compare", () => {
    expect(
      detectWeakCoverage(
        coverage({ competitorPages: [competitorPage({ wordCount: 1200 })] }),
      ),
    ).toBeNull();
  });

  it("does not fire when own coverage is comparable or better", () => {
    expect(
      detectWeakCoverage(
        coverage({
          ownPage: page({ wordCount: 1500 }),
          competitorPages: [competitorPage({ wordCount: 1200 })],
        }),
      ),
    ).toBeNull();
  });
});

describe("detectStale", () => {
  const now = new Date("2026-08-07T00:00:00.000Z");

  it("fires when the own page is older than the threshold", () => {
    const gap = detectStale(
      coverage({
        ownPage: page({ modifiedAt: "2025-01-01T00:00:00.000Z" }),
      }),
      now,
    );
    expect(gap?.kind).toBe("STALE");
  });

  it("does not fire on a recently modified page", () => {
    expect(
      detectStale(
        coverage({ ownPage: page({ modifiedAt: "2026-08-01T00:00:00.000Z" }) }),
        now,
      ),
    ).toBeNull();
  });

  it("does not fire when there is no date signal at all", () => {
    expect(
      detectStale(
        coverage({
          ownPage: page({
            modifiedAt: null,
            publishedAt: null,
            freshnessConfidence: 0,
          }),
        }),
        now,
      ),
    ).toBeNull();
  });
});

describe("detectIntentMismatch", () => {
  it("fires when the page's classified intent differs from the keyword's intent", () => {
    const gap = detectIntentMismatch(
      coverage({
        keywordIntent: "TRANSACTIONAL",
        ownPage: page({ intent: "INFORMATIONAL" }),
      }),
    );
    expect(gap?.kind).toBe("INTENT_MISMATCH");
  });

  it("does not fire when intents match", () => {
    expect(
      detectIntentMismatch(
        coverage({
          keywordIntent: "INFORMATIONAL",
          ownPage: page({ intent: "INFORMATIONAL" }),
        }),
      ),
    ).toBeNull();
  });

  it("does not fire when either intent is unknown", () => {
    expect(
      detectIntentMismatch(
        coverage({ keywordIntent: null, ownPage: page({ intent: null }) }),
      ),
    ).toBeNull();
  });
});

describe("detectComparisonGap", () => {
  it("fires when a competitor has comparison-style content and the brand doesn't", () => {
    const gap = detectComparisonGap(
      coverage({
        competitorPages: [
          competitorPage({ title: "Rival vs Acme: which is better?" }),
        ],
      }),
    );
    expect(gap?.kind).toBe("COMPARISON");
    expect(gap?.competitorId).toBe("competitor_1");
  });

  it("does not fire when the brand already has comparison content", () => {
    expect(
      detectComparisonGap(
        coverage({
          ownPage: page({ title: "Acme vs Rival" }),
          competitorPages: [competitorPage({ title: "Rival alternatives" })],
        }),
      ),
    ).toBeNull();
  });

  it("does not fire on ordinary (non-comparison) competitor titles", () => {
    expect(
      detectComparisonGap(
        coverage({
          competitorPages: [competitorPage({ title: "Widget care 101" })],
        }),
      ),
    ).toBeNull();
  });
});

describe("runTopicDetectors", () => {
  it("can surface more than one kind of gap for the same topic at once", () => {
    const gaps = runTopicDetectors(
      coverage({
        ownPage: page({
          wordCount: 200,
          modifiedAt: "2024-01-01T00:00:00.000Z",
        }),
        competitorPages: [competitorPage({ wordCount: 1500 })],
      }),
      new Date("2026-08-07T00:00:00.000Z"),
    );
    const kinds = gaps.map((gap) => gap.kind);
    expect(kinds).toContain("WEAK_COVERAGE");
    expect(kinds).toContain("STALE");
  });

  it("returns nothing for a topic with no gaps", () => {
    expect(
      runTopicDetectors(
        coverage({
          ownPage: page({ modifiedAt: "2026-08-01T00:00:00.000Z" }),
          competitorPages: [],
        }),
        new Date("2026-08-07T00:00:00.000Z"),
      ),
    ).toEqual([]);
  });
});

describe("detectCitationGaps", () => {
  const input = (
    overrides: Partial<CitationGapInput> = {},
  ): CitationGapInput => ({
    brandVisibility: 0.2,
    competitors: [
      {
        competitorId: "competitor_1",
        competitorName: "Rival Co",
        mentionShare: 0.5,
        mentionCount: 12,
      },
    ],
    ...overrides,
  });

  it("fires when a competitor's mention share exceeds the brand's by the margin", () => {
    const gaps = detectCitationGaps(input());
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.kind).toBe("CITATION_GAP");
    expect(gaps[0]?.competitorId).toBe("competitor_1");
  });

  it("does not fire when the margin isn't cleared", () => {
    expect(
      detectCitationGaps(
        input({
          competitors: [
            {
              competitorId: "competitor_1",
              competitorName: "Rival Co",
              mentionShare: 0.25,
              mentionCount: 5,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("does not fire with no benchmark data for the brand", () => {
    expect(detectCitationGaps(input({ brandVisibility: null }))).toEqual([]);
  });

  it("skips a competitor with zero mentions", () => {
    expect(
      detectCitationGaps(
        input({
          competitors: [
            {
              competitorId: "competitor_1",
              competitorName: "Rival Co",
              mentionShare: 0,
              mentionCount: 0,
            },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it("produces one gap per qualifying competitor", () => {
    const gaps = detectCitationGaps(
      input({
        competitors: [
          {
            competitorId: "competitor_1",
            competitorName: "Rival Co",
            mentionShare: 0.5,
            mentionCount: 12,
          },
          {
            competitorId: "competitor_2",
            competitorName: "Other Co",
            mentionShare: 0.45,
            mentionCount: 9,
          },
        ],
      }),
    );
    expect(gaps).toHaveLength(2);
  });
});
