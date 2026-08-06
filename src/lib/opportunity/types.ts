import type {
  KeywordIntent,
  OpportunityEvidenceKind,
  OpportunityKind,
  OpportunityStatus,
  ProjectKeywordPriority,
} from "@/generated/prisma/enums";

export type OpportunityComponentId =
  | "gapSeverity"
  | "competitiveCoverage"
  | "keywordPriority"
  | "evidenceStrength"
  | "citationPressure";

export type PageEvidence = {
  snapshotId: string;
  url: string;
  title: string | null;
  wordCount: number;
  intent: KeywordIntent | null;
  freshnessConfidence: number;
  publishedAt: string | null;
  modifiedAt: string | null;
  similarity: number;
};

export type CompetitorPageEvidence = PageEvidence & {
  competitorId: string;
  competitorName: string;
};

/**
 * Everything the topic-scoped detectors (missing-coverage, weak-coverage,
 * stale, intent-mismatch, comparison) need for one Topic, already resolved
 * by the service layer — see buildTopicCoverage() in
 * src/lib/opportunity/service.ts. Detectors themselves stay pure: no DB, no
 * embeddings, just decisions over this already-fetched evidence.
 */
export type TopicCoverage = {
  topicId: string;
  topicName: string;
  keywordId: string | null;
  keywordText: string | null;
  keywordIntent: KeywordIntent | null;
  keywordPriority: ProjectKeywordPriority | null;
  /** Best-matching own page above the similarity threshold, or null if none clears it. */
  ownPage: PageEvidence | null;
  /** Best-matching page per competitor above the similarity threshold — at most one per competitor. */
  competitorPages: CompetitorPageEvidence[];
  /** How many ACCEPTED competitors were checked, whether or not they matched — the denominator for competitiveCoverage. */
  totalTrackedCompetitors: number;
};

export type OpportunityEvidenceRef = {
  kind: OpportunityEvidenceKind;
  sourceTable: string;
  sourceId: string;
  url: string | null;
  note: string | null;
};

/**
 * What a detector produces before scoring. title/summary/recommendedActions
 * are deterministic (rule-based) so the feature works with no LLM
 * configured — src/lib/opportunity/explain.ts best-effort upgrades them
 * afterward. components feeds computeOpportunityScore(); a null value is
 * "no evidence for this component," masked out, never coerced to 0.
 */
export type DetectedGap = {
  kind: OpportunityKind;
  dedupeKey: string;
  title: string;
  summary: string;
  recommendedActions: string[];
  components: Partial<Record<OpportunityComponentId, number | null>>;
  topicId: string | null;
  keywordId: string | null;
  competitorId: string | null;
  evidence: OpportunityEvidenceRef[];
};

export type OpportunityDto = {
  id: string;
  kind: OpportunityKind;
  status: OpportunityStatus;
  score: number;
  confidence: number;
  components: Partial<
    Record<
      OpportunityComponentId,
      { weight: number; value: number | null; contribution: number | null }
    >
  >;
  title: string;
  summary: string;
  recommendedActions: string[];
  brandId: string;
  competitorId: string | null;
  topicId: string | null;
  keywordId: string | null;
  detectedAt: string;
};

export type OpportunityEvidenceDto = OpportunityEvidenceRef;

export type OpportunityDecisionDto = {
  id: string;
  status: OpportunityStatus;
  reason: string | null;
  actorId: string | null;
  decidedAt: string;
};

export type OpportunityDetailDto = OpportunityDto & {
  evidence: OpportunityEvidenceDto[];
  decisions: OpportunityDecisionDto[];
};

export type ConquestPlanDto = {
  id: string;
  weekStart: string;
  brandId: string;
};

export type PlanItemDto = {
  id: string;
  ownerId: string | null;
  dueAt: string | null;
  notes: string | null;
  planId: string;
  opportunity: OpportunityDto;
};
