import type {
  Competitor,
  SerpSnapshot,
  ThreatScore,
} from "@/generated/prisma/client";
import type { MarketDevice } from "@/generated/prisma/enums";
import { getBatch, getLatestAggregate } from "@/lib/benchmark/service";
import type { WorkspaceContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { scopedDb } from "@/lib/db/scoped";
import {
  buildThreatComponentInputs,
  type ObservationInput,
} from "@/lib/hunt/aggregate";
import type {
  CompetitorEvidenceDto,
  CompetitorWithScoreDto,
  SerpSnapshotDto,
  ThreatScoreDto,
  TrackedKeywordDto,
} from "@/lib/hunt/types";
import type { MappedSerpResult } from "@/lib/providers/dataforseo/mapper";
import {
  computeThreatScore,
  THREAT_COMPONENT_WEIGHTS,
  THREAT_SCORE_NAME,
  THREAT_SCORE_VERSION,
} from "@/lib/scoring/threat-v1";

function toSnapshotDto(snapshot: SerpSnapshot): SerpSnapshotDto {
  return {
    id: snapshot.id,
    keywordId: snapshot.keywordId,
    marketId: snapshot.marketId,
    device: snapshot.device,
    fetchedAt: snapshot.fetchedAt.toISOString(),
    resultCount: snapshot.resultCount,
  };
}

function toThreatScoreDto(score: ThreatScore): ThreatScoreDto {
  return {
    id: score.id,
    value: score.value,
    confidence: score.confidence,
    evidenceCount: score.evidenceCount,
    components: score.components as ThreatScoreDto["components"],
    computedAt: score.computedAt.toISOString(),
  };
}

function toCompetitorSummary(competitor: Competitor) {
  return {
    id: competitor.id,
    name: competitor.name,
    websiteUrl: competitor.websiteUrl,
    domain: competitor.domain,
    status: competitor.status,
  };
}

/** Every ACTIVE ProjectKeyword for a brand, joined to its Keyword text and market — what huntSerpBatch fans out over. */
export async function listTrackedKeywords(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<TrackedKeywordDto[]> {
  const rows = await scopedDb(ctx).projectKeyword.findMany({
    where: { brandId, status: "ACTIVE" },
    include: { keyword: { select: { id: true, text: true, marketId: true } } },
  });

  return rows.map((row) => ({
    keywordId: row.keyword.id,
    text: row.keyword.text,
    marketId: row.keyword.marketId,
  }));
}

/**
 * The cache-check huntSerpFetch runs before spending a DataForSEO credit —
 * a snapshot for the same (keyword, market, device) fetched within the TTL
 * is reused instead of refetched. See docs/events.md's concurrency section
 * for the companion per-provider rate limit.
 */
export async function findRecentSnapshot(
  ctx: WorkspaceContext,
  input: {
    keywordId: string;
    marketId: string;
    device: MarketDevice;
    ttlHours?: number;
  },
): Promise<SerpSnapshotDto | null> {
  const ttlHours = input.ttlHours ?? 20;
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

  const snapshot = await scopedDb(ctx).serpSnapshot.findFirst({
    where: {
      keywordId: input.keywordId,
      marketId: input.marketId,
      device: input.device,
      fetchedAt: { gte: cutoff },
    },
    orderBy: { fetchedAt: "desc" },
  });

  return snapshot ? toSnapshotDto(snapshot) : null;
}

export async function persistSerpSnapshot(
  ctx: WorkspaceContext,
  input: {
    keywordId: string;
    marketId: string;
    device: MarketDevice;
    providerCallId: string | null;
    rawSnapshotId: string | null;
    results: MappedSerpResult[];
    resultCount: number;
  },
): Promise<SerpSnapshotDto> {
  const snapshot = await scopedDb(ctx).serpSnapshot.create({
    data: {
      workspaceId: ctx.workspaceId,
      keywordId: input.keywordId,
      marketId: input.marketId,
      device: input.device,
      providerCallId: input.providerCallId,
      rawSnapshotId: input.rawSnapshotId,
      resultCount: input.resultCount,
      results: {
        create: input.results.map((result) => ({
          workspaceId: ctx.workspaceId,
          position: result.position,
          url: result.url,
          domain: result.domain,
          registrableDomain: result.registrableDomain,
          title: result.title,
          snippet: result.snippet,
          type: result.type,
        })),
      },
    },
  });

  return toSnapshotDto(snapshot);
}

/**
 * One CompetitorObservation per distinct registrable domain in the organic
 * results (deduped to each domain's best position within this snapshot —
 * a domain ranking twice on one SERP is one piece of evidence, not two),
 * excluding the brand's own domain. competitorId is set when the domain
 * matches an existing accepted/pinned Competitor; otherwise the row is
 * still stored with just candidateDomain, ready for a future
 * SERP-discovered competitor suggestion (Competitor.source =
 * SERP_DISCOVERED) — nothing promotes those automatically yet.
 */
export async function recordCompetitorObservations(
  ctx: WorkspaceContext,
  input: {
    brandId: string;
    keywordId: string;
    snapshotId: string;
    results: MappedSerpResult[];
  },
): Promise<void> {
  const [brand, competitors] = await Promise.all([
    scopedDb(ctx).brand.findFirstOrThrow({
      where: { id: input.brandId },
      select: { domain: true },
    }),
    scopedDb(ctx).competitor.findMany({
      where: { brandId: input.brandId, status: { in: ["ACCEPTED", "PINNED"] } },
      select: { id: true, domain: true },
    }),
  ]);
  const competitorIdByDomain = new Map(
    competitors.map((competitor) => [competitor.domain, competitor.id]),
  );

  const bestByDomain = new Map<string, MappedSerpResult>();
  for (const result of input.results) {
    if (result.type !== "ORGANIC") continue;
    if (result.registrableDomain === brand.domain) continue;
    if (!result.registrableDomain) continue;

    const existing = bestByDomain.get(result.registrableDomain);
    if (!existing || result.position < existing.position) {
      bestByDomain.set(result.registrableDomain, result);
    }
  }

  const deduped = [...bestByDomain.values()];
  if (deduped.length === 0) return;

  await scopedDb(ctx).competitorObservation.createMany({
    data: deduped.map((result) => ({
      workspaceId: ctx.workspaceId,
      candidateDomain: result.registrableDomain,
      position: result.position,
      snapshotId: input.snapshotId,
      keywordId: input.keywordId,
      competitorId: competitorIdByDomain.get(result.registrableDomain) ?? null,
    })),
  });
}

/**
 * ScoreDefinition is a global catalog (no workspaceId) — read/written
 * through the plain db client, never scopedDb(). Exported because the
 * hunt/threat.recompute.requested event carries a resolved scoreDefinitionId
 * (see docs/events.md) — the sender resolves it once and every competitor's
 * computeAndStoreThreatScore() call in that batch reuses the same id, rather
 * than each one re-resolving (and racing to create) the definition row.
 */
export async function getOrCreateThreatScoreDefinitionId(): Promise<string> {
  const existing = await db.scoreDefinition.findUnique({
    where: {
      name_version: { name: THREAT_SCORE_NAME, version: THREAT_SCORE_VERSION },
    },
  });
  if (existing) return existing.id;

  const created = await db.scoreDefinition.create({
    data: {
      name: THREAT_SCORE_NAME,
      version: THREAT_SCORE_VERSION,
      weights: THREAT_COMPONENT_WEIGHTS,
    },
  });
  return created.id;
}

async function getBenchmarkMentionTotals(
  ctx: WorkspaceContext,
  brandId: string,
  competitorId: string,
): Promise<{ competitorMentions: number; brandMentions: number } | null> {
  const latest = await getLatestAggregate(ctx, brandId);
  if (!latest) return null;

  const detail = await getBatch(ctx, latest.batch.id);
  if (!detail) return null;

  let competitorMentions = 0;
  let brandMentions = 0;
  for (const run of detail.runs) {
    if (!run.analysis || run.analysis.refused) continue;
    brandMentions += run.analysis.mentionCount;
    competitorMentions += run.analysis.competitorMentions[competitorId] ?? 0;
  }

  return { competitorMentions, brandMentions };
}

/**
 * Recomputes and stores a NEW ThreatScore row — never upserted or
 * overwritten. Per §7.3 of the implementation plan, old evidence must stay
 * recomputable under a new score version without losing the original
 * score, so every call here is an append to (competitorId, computedAt)'s
 * history, not a mutation of a "current" row.
 */
export async function computeAndStoreThreatScore(
  ctx: WorkspaceContext,
  input: { brandId: string; competitorId: string; scoreDefinitionId: string },
): Promise<ThreatScoreDto> {
  const totalTrackedKeywords = await scopedDb(ctx).projectKeyword.count({
    where: { brandId: input.brandId, status: "ACTIVE" },
  });

  const rawObservations = await scopedDb(ctx).competitorObservation.findMany({
    where: { competitorId: input.competitorId },
    include: { snapshot: { select: { fetchedAt: true } } },
  });
  const observations: ObservationInput[] = rawObservations.map(
    (observation) => ({
      keywordId: observation.keywordId,
      position: observation.position,
      snapshotFetchedAt: observation.snapshot.fetchedAt.toISOString(),
    }),
  );

  const mentionTotals = await getBenchmarkMentionTotals(
    ctx,
    input.brandId,
    input.competitorId,
  );

  const { inputs, evidenceCount } = buildThreatComponentInputs({
    observations,
    totalTrackedKeywords,
    competitorMentions: mentionTotals?.competitorMentions ?? 0,
    brandMentions: mentionTotals?.brandMentions ?? 0,
  });

  const result = computeThreatScore(inputs, evidenceCount);

  const stored = await scopedDb(ctx).threatScore.create({
    data: {
      workspaceId: ctx.workspaceId,
      competitorId: input.competitorId,
      scoreDefinitionId: input.scoreDefinitionId,
      value: result.value,
      confidence: result.confidence,
      evidenceCount: result.evidenceCount,
      components: result.components,
    },
  });

  return toThreatScoreDto(stored);
}

export async function listCompetitorsWithLatestScore(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<CompetitorWithScoreDto[]> {
  const competitors = await scopedDb(ctx).competitor.findMany({
    where: { brandId, status: { in: ["ACCEPTED", "PINNED"] } },
    include: { threatScores: { orderBy: { computedAt: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  return competitors.map((competitor) => ({
    ...toCompetitorSummary(competitor),
    latestScore: competitor.threatScores[0]
      ? toThreatScoreDto(competitor.threatScores[0])
      : null,
  }));
}

export async function getCompetitorEvidence(
  ctx: WorkspaceContext,
  competitorId: string,
): Promise<CompetitorEvidenceDto | null> {
  const competitor = await scopedDb(ctx).competitor.findFirst({
    where: { id: competitorId },
    include: {
      threatScores: { orderBy: { computedAt: "desc" }, take: 10 },
      observations: {
        include: {
          keyword: { select: { text: true } },
          snapshot: { select: { fetchedAt: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!competitor) return null;

  return {
    competitor: toCompetitorSummary(competitor),
    latestScore: competitor.threatScores[0]
      ? toThreatScoreDto(competitor.threatScores[0])
      : null,
    scoreHistory: competitor.threatScores.map(toThreatScoreDto),
    observations: competitor.observations.map((observation) => ({
      keywordId: observation.keywordId,
      keywordText: observation.keyword.text,
      position: observation.position,
      snapshotFetchedAt: observation.snapshot.fetchedAt.toISOString(),
    })),
  };
}
