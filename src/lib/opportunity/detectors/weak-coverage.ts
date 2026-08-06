import { buildDedupeKey } from "@/lib/opportunity/dedupe";
import {
  normalizeCompetitiveCoverage,
  normalizeEvidenceStrength,
  normalizeKeywordPriority,
} from "@/lib/opportunity/normalize";
import type { DetectedGap, TopicCoverage } from "@/lib/opportunity/types";

const KIND = "WEAK_COVERAGE" as const;

// A page has to be both proportionally and absolutely thinner than
// competitor coverage to count — proportion alone would flag a 400-word
// page as "weak" next to a 500-word competitor, which isn't a real gap.
const RATIO_THRESHOLD = 0.6;
const MIN_WORD_COUNT_GAP = 200;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Fires when the brand's own matching page is both proportionally and absolutely thinner than competitor coverage on the same topic. */
export function detectWeakCoverage(
  coverage: TopicCoverage,
): DetectedGap | null {
  if (!coverage.ownPage || coverage.competitorPages.length === 0) return null;

  const avgCompetitorWords =
    coverage.competitorPages.reduce((sum, page) => sum + page.wordCount, 0) /
    coverage.competitorPages.length;
  if (avgCompetitorWords <= 0) return null;

  const ratio = coverage.ownPage.wordCount / avgCompetitorWords;
  const gap = avgCompetitorWords - coverage.ownPage.wordCount;
  if (ratio >= RATIO_THRESHOLD || gap < MIN_WORD_COUNT_GAP) return null;

  return {
    kind: KIND,
    dedupeKey: buildDedupeKey(KIND, { topicId: coverage.topicId }),
    title: `Thin coverage on "${coverage.topicName}"`,
    summary: `Your page (${coverage.ownPage.wordCount} words) is significantly shorter than competitor coverage (avg ${Math.round(avgCompetitorWords)} words).`,
    recommendedActions: [
      `Expand ${coverage.ownPage.url} with more depth`,
      "Cover subtopics competitors include that you don't",
    ],
    components: {
      gapSeverity: clamp01(1 - ratio),
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
    evidence: [
      {
        kind: "OWN_PAGE" as const,
        sourceTable: "PageSnapshot",
        sourceId: coverage.ownPage.snapshotId,
        url: coverage.ownPage.url,
        note: `${coverage.ownPage.wordCount} words`,
      },
      ...coverage.competitorPages.map((page) => ({
        kind: "COMPETITOR_PAGE" as const,
        sourceTable: "PageSnapshot",
        sourceId: page.snapshotId,
        url: page.url,
        note: `${page.competitorName}: ${page.wordCount} words`,
      })),
    ],
  };
}
