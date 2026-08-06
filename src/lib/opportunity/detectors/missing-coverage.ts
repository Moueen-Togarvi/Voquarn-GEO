import { buildDedupeKey } from "@/lib/opportunity/dedupe";
import {
  normalizeCompetitiveCoverage,
  normalizeEvidenceStrength,
  normalizeKeywordPriority,
} from "@/lib/opportunity/normalize";
import type { DetectedGap, TopicCoverage } from "@/lib/opportunity/types";

const KIND = "MISSING_COVERAGE" as const;

/** Fires when at least one tracked competitor has matching content for a topic and the brand has none. */
export function detectMissingCoverage(
  coverage: TopicCoverage,
): DetectedGap | null {
  if (coverage.ownPage !== null) return null;
  if (coverage.competitorPages.length === 0) return null;

  const competitorNames = [
    ...new Set(coverage.competitorPages.map((page) => page.competitorName)),
  ];

  return {
    kind: KIND,
    dedupeKey: buildDedupeKey(KIND, { topicId: coverage.topicId }),
    title: `No content for "${coverage.topicName}"`,
    summary: `${competitorNames.length} of your ${coverage.totalTrackedCompetitors} tracked competitor${coverage.totalTrackedCompetitors === 1 ? "" : "s"} (${competitorNames.join(", ")}) ${competitorNames.length === 1 ? "has" : "have"} content on this topic. You have none.`,
    recommendedActions: [
      `Draft a new page targeting "${coverage.keywordText ?? coverage.topicName}"`,
    ],
    components: {
      gapSeverity: 1,
      competitiveCoverage: normalizeCompetitiveCoverage(
        coverage.competitorPages.length,
        coverage.totalTrackedCompetitors,
      ),
      keywordPriority: normalizeKeywordPriority(coverage.keywordPriority),
      evidenceStrength: normalizeEvidenceStrength(
        coverage.competitorPages.length,
      ),
      citationPressure: null,
    },
    topicId: coverage.topicId,
    keywordId: coverage.keywordId,
    competitorId: null,
    evidence: coverage.competitorPages.map((page) => ({
      kind: "COMPETITOR_PAGE" as const,
      sourceTable: "PageSnapshot",
      sourceId: page.snapshotId,
      url: page.url,
      note: `${page.competitorName} covers this topic`,
    })),
  };
}
