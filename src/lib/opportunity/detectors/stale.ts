import { buildDedupeKey } from "@/lib/opportunity/dedupe";
import {
  normalizeCompetitiveCoverage,
  normalizeEvidenceStrength,
  normalizeKeywordPriority,
} from "@/lib/opportunity/normalize";
import type { DetectedGap, TopicCoverage } from "@/lib/opportunity/types";

const KIND = "STALE" as const;
const DAY_MS = 86_400_000;
const STALE_THRESHOLD_DAYS = 180;
// Severity reaches 1 at two years old, not just "somewhat past threshold" —
// a page 181 days old and one 700 days old are not the same problem.
const STALE_MAX_DAYS = 730;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Fires when the brand's own matching page's best-known date (modified,
 * falling back to published) is older than the threshold. Never fires on
 * freshnessConfidence <= 0 — no date signal at all means "unknown," not
 * "stale."
 */
export function detectStale(
  coverage: TopicCoverage,
  now: Date,
): DetectedGap | null {
  if (!coverage.ownPage) return null;
  const dateStr = coverage.ownPage.modifiedAt ?? coverage.ownPage.publishedAt;
  if (!dateStr || coverage.ownPage.freshnessConfidence <= 0) return null;

  const ageDays = (now.getTime() - new Date(dateStr).getTime()) / DAY_MS;
  if (ageDays < STALE_THRESHOLD_DAYS) return null;

  return {
    kind: KIND,
    dedupeKey: buildDedupeKey(KIND, { topicId: coverage.topicId }),
    title: `"${coverage.topicName}" content is stale`,
    summary: `Last updated ${Math.round(ageDays)} days ago (freshness confidence ${Math.round(coverage.ownPage.freshnessConfidence * 100)}%).`,
    recommendedActions: [
      `Refresh ${coverage.ownPage.url} with current information`,
    ],
    components: {
      gapSeverity: clamp01(
        (ageDays - STALE_THRESHOLD_DAYS) /
          (STALE_MAX_DAYS - STALE_THRESHOLD_DAYS),
      ),
      competitiveCoverage: normalizeCompetitiveCoverage(
        coverage.competitorPages.length,
        coverage.totalTrackedCompetitors,
      ),
      keywordPriority: normalizeKeywordPriority(coverage.keywordPriority),
      evidenceStrength: normalizeEvidenceStrength(1),
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
        note: `Last modified ${dateStr}`,
      },
    ],
  };
}
