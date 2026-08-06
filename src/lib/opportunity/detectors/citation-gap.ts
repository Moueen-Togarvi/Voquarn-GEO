import { buildDedupeKey } from "@/lib/opportunity/dedupe";
import { normalizeEvidenceStrength } from "@/lib/opportunity/normalize";
import type { DetectedGap } from "@/lib/opportunity/types";

const KIND = "CITATION_GAP" as const;

// A competitor's mention share has to clear the brand's own by a real
// margin, not just any positive delta — noise in a handful of benchmark
// runs shouldn't read as a citation gap.
const MARGIN = 0.15;

export type CitationGapCompetitor = {
  competitorId: string;
  competitorName: string;
  mentionShare: number;
  mentionCount: number;
};

export type CitationGapInput = {
  /** The brand's own share of tracked-brand AI-benchmark mentions, 0-1 — see normalizeCitationShare in src/lib/scoring/normalize.ts, reused for Threat Score. Null if there's no benchmark data yet. */
  brandVisibility: number | null;
  competitors: CitationGapCompetitor[];
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Brand-wide (per competitor), not topic-scoped — unlike the other five
 * detectors. AI-benchmark citation data (RunAnalysis.competitorMentions) has
 * no reliable link to a specific Topic/Keyword in this codebase yet (Prompt
 * text is freeform), so this reports "X is cited more than you" as a whole,
 * rather than forcing a false per-topic attribution.
 */
export function detectCitationGaps(input: CitationGapInput): DetectedGap[] {
  if (input.brandVisibility === null) return [];

  const gaps: DetectedGap[] = [];
  for (const competitor of input.competitors) {
    if (competitor.mentionCount === 0) continue;
    if (competitor.mentionShare - input.brandVisibility < MARGIN) continue;

    gaps.push({
      kind: KIND,
      dedupeKey: buildDedupeKey(KIND, {
        competitorId: competitor.competitorId,
      }),
      title: `${competitor.competitorName} is cited more often in AI answers`,
      summary: `${competitor.competitorName} appears in ${Math.round(competitor.mentionShare * 100)}% of tracked AI-answer mentions vs. your ${Math.round(input.brandVisibility * 100)}%.`,
      recommendedActions: [
        `Publish citable, well-sourced content on topics where ${competitor.competitorName} is winning citations`,
        `Review your benchmark runs to see exactly where ${competitor.competitorName} is mentioned and you aren't`,
      ],
      components: {
        gapSeverity: clamp01(competitor.mentionShare - input.brandVisibility),
        competitiveCoverage: null,
        keywordPriority: null,
        evidenceStrength: normalizeEvidenceStrength(
          competitor.mentionCount,
          10,
        ),
        citationPressure: clamp01(competitor.mentionShare),
      },
      topicId: null,
      keywordId: null,
      competitorId: competitor.competitorId,
      evidence: [
        {
          kind: "BENCHMARK_MENTION" as const,
          sourceTable: "BenchmarkAggregate",
          sourceId: competitor.competitorId,
          url: null,
          note: `${competitor.mentionCount} mentions, ${Math.round(competitor.mentionShare * 100)}% share`,
        },
      ],
    });
  }
  return gaps;
}
