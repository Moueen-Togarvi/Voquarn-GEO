import { buildDedupeKey } from "@/lib/opportunity/dedupe";
import {
  normalizeCompetitiveCoverage,
  normalizeEvidenceStrength,
  normalizeKeywordPriority,
} from "@/lib/opportunity/normalize";
import type {
  CompetitorPageEvidence,
  DetectedGap,
  TopicCoverage,
} from "@/lib/opportunity/types";

const KIND = "COMPARISON" as const;

const COMPARISON_MARKERS = [
  " vs ",
  " vs. ",
  " versus ",
  "alternative",
  "alternatives",
  "comparison",
  "compare ",
];

function looksLikeComparison(title: string | null): boolean {
  if (!title) return false;
  const padded = ` ${title.toLowerCase()} `;
  return COMPARISON_MARKERS.some((marker) => padded.includes(marker));
}

/** Fires when a tracked competitor has comparison/alternative-style content ("X vs Y", "X alternatives") on a topic and the brand has no equivalent. */
export function detectComparisonGap(
  coverage: TopicCoverage,
): DetectedGap | null {
  const comparisonPages: CompetitorPageEvidence[] =
    coverage.competitorPages.filter((page) => looksLikeComparison(page.title));
  if (comparisonPages.length === 0) return null;
  if (coverage.ownPage && looksLikeComparison(coverage.ownPage.title))
    return null;

  const primary = comparisonPages[0]!;
  const competitorNames = [
    ...new Set(comparisonPages.map((page) => page.competitorName)),
  ];

  return {
    kind: KIND,
    dedupeKey: buildDedupeKey(KIND, {
      topicId: coverage.topicId,
      competitorId: primary.competitorId,
    }),
    title: `Missing comparison content for "${coverage.topicName}"`,
    summary: `${competitorNames.join(", ")} publish${competitorNames.length === 1 ? "es" : ""} comparison or alternative content on this topic; you don't have an equivalent.`,
    recommendedActions: [
      `Create a comparison or "vs" page for "${coverage.topicName}"`,
    ],
    components: {
      gapSeverity: 1,
      competitiveCoverage: normalizeCompetitiveCoverage(
        comparisonPages.length,
        coverage.totalTrackedCompetitors,
      ),
      keywordPriority: normalizeKeywordPriority(coverage.keywordPriority),
      evidenceStrength: normalizeEvidenceStrength(comparisonPages.length),
      citationPressure: null,
    },
    topicId: coverage.topicId,
    keywordId: coverage.keywordId,
    competitorId: primary.competitorId,
    evidence: comparisonPages.map((page) => ({
      kind: "COMPETITOR_PAGE" as const,
      sourceTable: "PageSnapshot",
      sourceId: page.snapshotId,
      url: page.url,
      note: `${page.competitorName}: "${page.title}"`,
    })),
  };
}
