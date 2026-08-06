import { buildDedupeKey } from "@/lib/opportunity/dedupe";
import {
  normalizeCompetitiveCoverage,
  normalizeEvidenceStrength,
  normalizeKeywordPriority,
} from "@/lib/opportunity/normalize";
import type { DetectedGap, TopicCoverage } from "@/lib/opportunity/types";

const KIND = "INTENT_MISMATCH" as const;

/** Fires when the brand's own matching page's classified intent doesn't match its tracked keyword's intent — e.g. a blog post ranking for a transactional query. */
export function detectIntentMismatch(
  coverage: TopicCoverage,
): DetectedGap | null {
  if (!coverage.ownPage || !coverage.keywordIntent || !coverage.ownPage.intent)
    return null;
  if (coverage.ownPage.intent === coverage.keywordIntent) return null;

  return {
    kind: KIND,
    dedupeKey: buildDedupeKey(KIND, {
      topicId: coverage.topicId,
      keywordId: coverage.keywordId,
    }),
    title: `Intent mismatch on "${coverage.topicName}"`,
    summary: `"${coverage.keywordText ?? coverage.topicName}" reads as ${coverage.keywordIntent.toLowerCase()} intent, but your page reads as ${coverage.ownPage.intent.toLowerCase()}.`,
    recommendedActions: [
      `Rewrite ${coverage.ownPage.url} to match ${coverage.keywordIntent.toLowerCase()} intent`,
    ],
    components: {
      gapSeverity: 1,
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
        note: `Classified as ${coverage.ownPage.intent}`,
      },
      {
        kind: "KEYWORD" as const,
        sourceTable: "Keyword",
        sourceId: coverage.keywordId!,
        url: null,
        note: `Keyword intent: ${coverage.keywordIntent}`,
      },
    ],
  };
}
