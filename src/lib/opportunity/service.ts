import type { Opportunity, OpportunityStatus } from "@/generated/prisma/client";
import { getBatch, getLatestAggregate } from "@/lib/benchmark/service";
import { AppError } from "@/lib/api/errors";
import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";
import type { CitationGapInput } from "@/lib/opportunity/detectors/citation-gap";
import {
  findBestPageMatch,
  listTopicEmbeddings,
} from "@/lib/embeddings/service";
import {
  OPPORTUNITY_COMPONENT_WEIGHTS,
  OPPORTUNITY_SCORE_NAME,
  OPPORTUNITY_SCORE_VERSION,
  computeOpportunityScore,
} from "@/lib/opportunity/score";
import type {
  CompetitorPageEvidence,
  ConquestPlanDto,
  DetectedGap,
  OpportunityDetailDto,
  OpportunityDto,
  PlanItemDto,
  TopicCoverage,
} from "@/lib/opportunity/types";
import { weekStartOf } from "@/lib/opportunity/week";

/** Below this cosine similarity, a page is treated as "not about this topic" rather than a weak match — see the pgvector migration comment for why HNSW/cosine was chosen. */
const TOPIC_PAGE_SIMILARITY_THRESHOLD = 0.55;

function toOpportunityDto(row: Opportunity): OpportunityDto {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    score: row.score,
    confidence: row.confidence,
    components: row.components as OpportunityDto["components"],
    title: row.title,
    summary: row.summary,
    recommendedActions: row.recommendedActions as string[],
    brandId: row.brandId,
    competitorId: row.competitorId,
    topicId: row.topicId,
    keywordId: row.keywordId,
    detectedAt: row.detectedAt.toISOString(),
  };
}

// --- ScoreDefinition — global catalog, plain db client, same treatment as threat-v1's. ---

export async function getOrCreateOpportunityScoreDefinitionId(): Promise<string> {
  const existing = await db.scoreDefinition.findUnique({
    where: {
      name_version: {
        name: OPPORTUNITY_SCORE_NAME,
        version: OPPORTUNITY_SCORE_VERSION,
      },
    },
  });
  if (existing) return existing.id;

  const created = await db.scoreDefinition.create({
    data: {
      name: OPPORTUNITY_SCORE_NAME,
      version: OPPORTUNITY_SCORE_VERSION,
      weights: OPPORTUNITY_COMPONENT_WEIGHTS,
    },
  });
  return created.id;
}

// --- Topic coverage — composes embeddings similarity with keyword/competitor evidence. ---

export type CoverageCompetitor = {
  competitorId: string;
  competitorName: string;
  crawlRunId: string | null;
};

/**
 * One TopicCoverage per Topic that already has an embedding — a topic
 * embedded but not yet backed by any crawl data still comes back with
 * ownPage/competitorPages both empty, which the detectors correctly read as
 * "nothing to report" rather than skipping the topic outright. A topic with
 * NO embedding yet is skipped entirely (not enough evidence to match pages
 * to it) — the next detection run picks it up once
 * ensureTopicEmbeddings() has embedded it.
 */
export async function buildTopicCoverages(
  ctx: WorkspaceContext,
  input: {
    brandId: string;
    ownCrawlRunId: string | null;
    competitors: CoverageCompetitor[];
  },
): Promise<TopicCoverage[]> {
  const topics = await scopedDb(ctx).topic.findMany({
    where: { brandId: input.brandId },
  });
  if (topics.length === 0) return [];

  const embeddings = await listTopicEmbeddings(ctx, input.brandId);
  const embeddingByTopic = new Map(
    embeddings.map((row) => [row.topicId, row.embeddingLiteral]),
  );

  const coverages: TopicCoverage[] = [];
  for (const topic of topics) {
    const embeddingLiteral = embeddingByTopic.get(topic.id);
    if (!embeddingLiteral) continue;

    const projectKeyword = await scopedDb(ctx).projectKeyword.findFirst({
      where: {
        brandId: input.brandId,
        status: "ACTIVE",
        keyword: { topicId: topic.id },
      },
      include: { keyword: { select: { id: true, text: true, intent: true } } },
    });

    const ownPage = input.ownCrawlRunId
      ? await findBestPageMatch(ctx, {
          crawlRunId: input.ownCrawlRunId,
          topicEmbeddingLiteral: embeddingLiteral,
          minSimilarity: TOPIC_PAGE_SIMILARITY_THRESHOLD,
        })
      : null;

    const competitorPages: CompetitorPageEvidence[] = [];
    for (const competitor of input.competitors) {
      if (!competitor.crawlRunId) continue;
      const match = await findBestPageMatch(ctx, {
        crawlRunId: competitor.crawlRunId,
        topicEmbeddingLiteral: embeddingLiteral,
        minSimilarity: TOPIC_PAGE_SIMILARITY_THRESHOLD,
      });
      if (match) {
        competitorPages.push({
          ...match,
          competitorId: competitor.competitorId,
          competitorName: competitor.competitorName,
        });
      }
    }

    coverages.push({
      topicId: topic.id,
      topicName: topic.name,
      keywordId: projectKeyword?.keyword.id ?? null,
      keywordText: projectKeyword?.keyword.text ?? null,
      keywordIntent: projectKeyword?.keyword.intent ?? null,
      keywordPriority: projectKeyword?.priority ?? null,
      ownPage,
      competitorPages,
      totalTrackedCompetitors: input.competitors.length,
    });
  }
  return coverages;
}

/**
 * Per-competitor AI-benchmark citation share for the CITATION_GAP detector.
 * Deliberately recomputes brandVisibility from the same run-level loop as
 * the per-competitor shares, rather than reusing BenchmarkAggregate.shareOfVoice
 * (computed once over every mentioned competitor, not just ACCEPTED ones) —
 * mixing the two would use different denominators and the percentages
 * wouldn't reconcile.
 */
export async function getBenchmarkCitationShares(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<CitationGapInput> {
  const competitors = await scopedDb(ctx).competitor.findMany({
    where: { brandId, status: { in: ["ACCEPTED", "PINNED"] } },
  });

  const empty: CitationGapInput = {
    brandVisibility: null,
    competitors: competitors.map((competitor) => ({
      competitorId: competitor.id,
      competitorName: competitor.name,
      mentionShare: 0,
      mentionCount: 0,
    })),
  };

  const latest = await getLatestAggregate(ctx, brandId);
  if (!latest) return empty;

  const detail = await getBatch(ctx, latest.batch.id);
  if (!detail) return empty;

  let brandMentions = 0;
  const competitorMentions: Record<string, number> = {};
  for (const run of detail.runs) {
    if (!run.analysis || run.analysis.refused) continue;
    brandMentions += run.analysis.mentionCount;
    for (const competitor of competitors) {
      competitorMentions[competitor.id] =
        (competitorMentions[competitor.id] ?? 0) +
        (run.analysis.competitorMentions[competitor.id]?.count ?? 0);
    }
  }

  const totalCompetitorMentions = Object.values(competitorMentions).reduce(
    (sum, count) => sum + count,
    0,
  );
  const total = brandMentions + totalCompetitorMentions;

  return {
    brandVisibility: total > 0 ? brandMentions / total : null,
    competitors: competitors.map((competitor) => ({
      competitorId: competitor.id,
      competitorName: competitor.name,
      mentionShare:
        total > 0 ? (competitorMentions[competitor.id] ?? 0) / total : 0,
      mentionCount: competitorMentions[competitor.id] ?? 0,
    })),
  };
}

// --- Opportunity persistence ---

/**
 * Scores and persists one detected gap — returns null, without throwing, if
 * an Opportunity with the same (brandId, dedupeKey) already exists. This is
 * deliberately a create-or-skip, never an upsert: refreshing the score of an
 * existing gap on every detection run would also silently reset a human's
 * DISMISSED/ACCEPTED decision back to whatever the row would look like on
 * update, which is exactly what dedupeKey exists to prevent. A future
 * version that wants fresher scores on existing NEW opportunities should
 * update only rows still in NEW status, explicitly, rather than changing
 * this function.
 */
export async function createOpportunityIfNew(
  ctx: WorkspaceContext,
  input: { brandId: string; gap: DetectedGap; scoreDefinitionId: string },
): Promise<OpportunityDto | null> {
  const scoreResult = computeOpportunityScore(input.gap.components);

  try {
    const created = await scopedDb(ctx).opportunity.create({
      data: {
        workspaceId: ctx.workspaceId,
        brandId: input.brandId,
        kind: input.gap.kind,
        dedupeKey: input.gap.dedupeKey,
        title: input.gap.title,
        summary: input.gap.summary,
        recommendedActions: input.gap.recommendedActions,
        score: scoreResult.value,
        confidence: scoreResult.confidence,
        components: scoreResult.components,
        scoreDefinitionId: input.scoreDefinitionId,
        topicId: input.gap.topicId,
        keywordId: input.gap.keywordId,
        competitorId: input.gap.competitorId,
        evidence: {
          create: input.gap.evidence.map((item) => ({
            workspaceId: ctx.workspaceId,
            kind: item.kind,
            sourceTable: item.sourceTable,
            sourceId: item.sourceId,
            url: item.url,
            note: item.note,
          })),
        },
      },
    });
    return toOpportunityDto(created);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) return null;
    throw error;
  }
}

/** Best-effort — overwrites title/summary/recommendedActions with an LLM-narrated version. Never called for a skipped (already-existing) opportunity. */
export async function upgradeOpportunityText(
  ctx: WorkspaceContext,
  opportunityId: string,
  text: { title: string; summary: string; recommendedActions: string[] },
): Promise<void> {
  await scopedDb(ctx).opportunity.update({
    where: { id: opportunityId },
    data: {
      title: text.title,
      summary: text.summary,
      recommendedActions: text.recommendedActions,
    },
  });
}

export async function listOpportunities(
  ctx: WorkspaceContext,
  input: { brandId: string; status?: OpportunityStatus },
): Promise<OpportunityDto[]> {
  const rows = await scopedDb(ctx).opportunity.findMany({
    where: { brandId: input.brandId, status: input.status },
    orderBy: [{ score: "desc" }],
  });
  return rows.map(toOpportunityDto);
}

export async function getOpportunity(
  ctx: WorkspaceContext,
  opportunityId: string,
): Promise<OpportunityDetailDto | null> {
  const row = await scopedDb(ctx).opportunity.findFirst({
    where: { id: opportunityId },
    include: {
      evidence: true,
      decisions: { orderBy: { decidedAt: "desc" } },
    },
  });
  if (!row) return null;

  return {
    ...toOpportunityDto(row),
    evidence: row.evidence.map((item) => ({
      kind: item.kind,
      sourceTable: item.sourceTable,
      sourceId: item.sourceId,
      url: item.url,
      note: item.note,
    })),
    decisions: row.decisions.map((decision) => ({
      id: decision.id,
      status: decision.status,
      reason: decision.reason,
      actorId: decision.actorId,
      decidedAt: decision.decidedAt.toISOString(),
    })),
  };
}

/** The human decision step — accept/defer/dismiss/complete. Appends an OpportunityDecision row (full history, never mutated) and mirrors the latest one onto Opportunity.status. */
export async function recordOpportunityDecision(
  ctx: WorkspaceContext,
  opportunityId: string,
  input: { status: OpportunityStatus; reason?: string; actorId?: string },
): Promise<OpportunityDto> {
  assertRole(ctx, "EDITOR");

  await scopedDb(ctx).opportunityDecision.create({
    data: {
      workspaceId: ctx.workspaceId,
      opportunityId,
      status: input.status,
      reason: input.reason ?? null,
      actorId: input.actorId ?? null,
    },
  });

  try {
    const updated = await scopedDb(ctx).opportunity.update({
      where: { id: opportunityId },
      data: { status: input.status },
    });
    return toOpportunityDto(updated);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(
        404,
        "OPPORTUNITY_NOT_FOUND",
        "Opportunity not found.",
      );
    }
    throw error;
  }
}

// --- Conquest plan ---

function toConquestPlanDto(plan: {
  id: string;
  weekStart: Date;
  brandId: string;
}): ConquestPlanDto {
  return {
    id: plan.id,
    weekStart: plan.weekStart.toISOString(),
    brandId: plan.brandId,
  };
}

export async function getOrCreateCurrentWeekPlan(
  ctx: WorkspaceContext,
  brandId: string,
  now = new Date(),
): Promise<ConquestPlanDto> {
  const weekStart = weekStartOf(now);
  const plan = await scopedDb(ctx).conquestPlan.upsert({
    where: { brandId_weekStart: { brandId, weekStart } },
    update: {},
    create: { workspaceId: ctx.workspaceId, brandId, weekStart },
  });
  return toConquestPlanDto(plan);
}

export async function addPlanItem(
  ctx: WorkspaceContext,
  input: {
    brandId: string;
    opportunityId: string;
    ownerId?: string;
    dueAt?: Date;
    notes?: string;
  },
): Promise<PlanItemDto> {
  assertRole(ctx, "EDITOR");

  const plan = await getOrCreateCurrentWeekPlan(ctx, input.brandId);
  const opportunity = await scopedDb(ctx).opportunity.findFirst({
    where: { id: input.opportunityId },
  });
  if (!opportunity) {
    throw new AppError(404, "OPPORTUNITY_NOT_FOUND", "Opportunity not found.");
  }

  try {
    const item = await scopedDb(ctx).planItem.create({
      data: {
        workspaceId: ctx.workspaceId,
        planId: plan.id,
        opportunityId: input.opportunityId,
        ownerId: input.ownerId ?? null,
        dueAt: input.dueAt ?? null,
        notes: input.notes ?? null,
      },
    });
    return {
      id: item.id,
      ownerId: item.ownerId,
      dueAt: item.dueAt?.toISOString() ?? null,
      notes: item.notes,
      planId: item.planId,
      opportunity: toOpportunityDto(opportunity),
    };
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new AppError(
        409,
        "VALIDATION_ERROR",
        "This opportunity is already on the plan for this week.",
      );
    }
    throw error;
  }
}

export async function listCurrentPlanItems(
  ctx: WorkspaceContext,
  brandId: string,
  now = new Date(),
): Promise<{ plan: ConquestPlanDto; items: PlanItemDto[] }> {
  const weekStart = weekStartOf(now);
  const plan = await scopedDb(ctx).conquestPlan.findFirst({
    where: { brandId, weekStart },
    include: {
      items: { include: { opportunity: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!plan) {
    const created = await getOrCreateCurrentWeekPlan(ctx, brandId, now);
    return { plan: created, items: [] };
  }

  return {
    plan: toConquestPlanDto(plan),
    items: plan.items.map((item) => ({
      id: item.id,
      ownerId: item.ownerId,
      dueAt: item.dueAt?.toISOString() ?? null,
      notes: item.notes,
      planId: item.planId,
      opportunity: toOpportunityDto(item.opportunity),
    })),
  };
}

export async function removePlanItem(
  ctx: WorkspaceContext,
  planItemId: string,
): Promise<void> {
  assertRole(ctx, "EDITOR");
  try {
    await scopedDb(ctx).planItem.delete({ where: { id: planItemId } });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(404, "PLAN_ITEM_NOT_FOUND", "Plan item not found.");
    }
    throw error;
  }
}
