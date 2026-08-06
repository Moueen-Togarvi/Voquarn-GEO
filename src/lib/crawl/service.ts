import { createHash } from "node:crypto";

import type {
  CrawlRun,
  PageObservation,
  PageSnapshot,
  PerformanceObservation,
  SchemaObservation,
} from "@/generated/prisma/client";
import type {
  CrawlRunStatus,
  KeywordIntent,
  PerformanceSource,
  RenderMode,
} from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import type { ExtractedPage } from "@/lib/crawl/extract";
import type { FreshnessResult } from "@/lib/crawl/freshness";
import type { SchemaValidationResult } from "@/lib/crawl/schema-validate";
import type {
  CrawlRunDto,
  PageSnapshotDetailDto,
  PageSnapshotDto,
} from "@/lib/crawl/types";
import { db } from "@/lib/db";
import { scopedDb } from "@/lib/db/scoped";

export function computeContentHash(html: string): string {
  return createHash("sha256").update(html).digest("hex");
}

// --- robots.txt cache — global, no workspaceId, plain db client ---

const ROBOTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function getCachedRobots(host: string): Promise<string | null> {
  const cached = await db.robotsCache.findUnique({ where: { host } });
  if (!cached) return null;
  if (cached.expiresAt.getTime() < Date.now()) return null;
  return cached.body;
}

export async function cacheRobots(host: string, body: string): Promise<void> {
  const expiresAt = new Date(Date.now() + ROBOTS_CACHE_TTL_MS);
  await db.robotsCache.upsert({
    where: { host },
    update: { body, fetchedAt: new Date(), expiresAt },
    create: { host, body, expiresAt },
  });
}

// --- AI crawler access — global, no workspaceId, plain db client ---

export async function persistAiCrawlerAccess(
  domain: string,
  entries: { botName: string; allowed: boolean; evidence: string }[],
): Promise<void> {
  for (const entry of entries) {
    await db.aiCrawlerAccess.upsert({
      where: { domain_botName: { domain, botName: entry.botName } },
      update: {
        allowed: entry.allowed,
        evidence: entry.evidence,
        checkedAt: new Date(),
      },
      create: {
        domain,
        botName: entry.botName,
        allowed: entry.allowed,
        evidence: entry.evidence,
      },
    });
  }
}

export async function getAiCrawlerAccess(domain: string) {
  return db.aiCrawlerAccess.findMany({
    where: { domain },
    orderBy: { botName: "asc" },
  });
}

// --- CrawlRun lifecycle ---

function toCrawlRunDto(run: CrawlRun): CrawlRunDto {
  return {
    id: run.id,
    host: run.host,
    status: run.status,
    totalPages: run.totalPages,
    completedPages: run.completedPages,
    failedPages: run.failedPages,
    brandId: run.brandId,
    competitorId: run.competitorId,
    operationId: run.operationId,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
  };
}

export async function createCrawlRun(
  ctx: WorkspaceContext,
  input: {
    host: string;
    brandId?: string | null;
    competitorId?: string | null;
    operationId: string;
  },
): Promise<CrawlRunDto> {
  const run = await scopedDb(ctx).crawlRun.create({
    data: {
      workspaceId: ctx.workspaceId,
      host: input.host,
      brandId: input.brandId ?? null,
      competitorId: input.competitorId ?? null,
      operationId: input.operationId,
      status: "PENDING",
    },
  });
  return toCrawlRunDto(run);
}

export async function startCrawlRun(
  ctx: WorkspaceContext,
  crawlRunId: string,
  totalPages: number,
): Promise<void> {
  await scopedDb(ctx).crawlRun.update({
    where: { id: crawlRunId },
    data: { status: "RUNNING", startedAt: new Date(), totalPages },
  });
}

/** Atomic — safe to call from concurrently-executing fan-out branches. */
export async function incrementCrawlRunCounter(
  ctx: WorkspaceContext,
  crawlRunId: string,
  field: "completedPages" | "failedPages",
): Promise<CrawlRun> {
  return scopedDb(ctx).crawlRun.update({
    where: { id: crawlRunId },
    data: { [field]: { increment: 1 } },
  });
}

export async function finalizeCrawlRun(
  ctx: WorkspaceContext,
  crawlRunId: string,
): Promise<CrawlRunDto> {
  const run = await scopedDb(ctx).crawlRun.findFirstOrThrow({
    where: { id: crawlRunId },
  });

  let status: CrawlRunStatus;
  if (run.totalPages === 0 || run.failedPages === 0) {
    status = "COMPLETED";
  } else if (run.failedPages >= run.totalPages) {
    status = "FAILED";
  } else {
    status = "PARTIAL_FAILURE";
  }

  const updated = await scopedDb(ctx).crawlRun.update({
    where: { id: crawlRunId },
    data: { status, completedAt: new Date() },
  });
  return toCrawlRunDto(updated);
}

export async function listCrawlRuns(
  ctx: WorkspaceContext,
  input: { brandId?: string; competitorId?: string },
): Promise<CrawlRunDto[]> {
  const runs = await scopedDb(ctx).crawlRun.findMany({
    where: { brandId: input.brandId, competitorId: input.competitorId },
    orderBy: { createdAt: "desc" },
  });
  return runs.map(toCrawlRunDto);
}

export async function getLatestCrawlRun(
  ctx: WorkspaceContext,
  input: { brandId?: string; competitorId?: string },
): Promise<CrawlRunDto | null> {
  const run = await scopedDb(ctx).crawlRun.findFirst({
    where: { brandId: input.brandId, competitorId: input.competitorId },
    orderBy: { createdAt: "desc" },
  });
  return run ? toCrawlRunDto(run) : null;
}

// --- PageSnapshot + observations ---

function toSnapshotDto(snapshot: PageSnapshot): PageSnapshotDto {
  return {
    id: snapshot.id,
    url: snapshot.url,
    canonicalUrl: snapshot.canonicalUrl,
    contentHash: snapshot.contentHash,
    httpStatus: snapshot.httpStatus,
    renderMode: snapshot.renderMode,
    fetchedAt: snapshot.fetchedAt.toISOString(),
    crawlRunId: snapshot.crawlRunId,
  };
}

function toObservationDto(observation: PageObservation) {
  return {
    title: observation.title,
    description: observation.description,
    headings: observation.headings as { level: number; text: string }[],
    wordCount: observation.wordCount,
    internalLinks: observation.internalLinks,
    externalLinks: observation.externalLinks,
    mediaCounts: observation.mediaCounts as {
      images: number;
      videos: number;
      audio: number;
    },
    publishedAt: observation.publishedAt?.toISOString() ?? null,
    modifiedAt: observation.modifiedAt?.toISOString() ?? null,
    freshnessConfidence: observation.freshnessConfidence,
    intent: observation.intent,
  };
}

function toSchemaDto(schema: SchemaObservation) {
  return {
    type: schema.type,
    valid: schema.valid,
    mismatches: schema.mismatches as string[],
  };
}

function toPerformanceDto(performance: PerformanceObservation) {
  return {
    lcp: performance.lcp,
    inp: performance.inp,
    cls: performance.cls,
    source: performance.source,
  };
}

export async function persistPageSnapshot(
  ctx: WorkspaceContext,
  input: {
    crawlRunId: string;
    url: string;
    canonicalUrl: string | null;
    contentHash: string;
    httpStatus: number;
    renderMode: RenderMode;
    rawSnapshotId: string | null;
  },
): Promise<PageSnapshotDto> {
  const snapshot = await scopedDb(ctx).pageSnapshot.create({
    data: {
      workspaceId: ctx.workspaceId,
      crawlRunId: input.crawlRunId,
      url: input.url,
      canonicalUrl: input.canonicalUrl,
      contentHash: input.contentHash,
      httpStatus: input.httpStatus,
      renderMode: input.renderMode,
      rawSnapshotId: input.rawSnapshotId,
    },
  });
  return toSnapshotDto(snapshot);
}

export async function persistPageObservation(
  ctx: WorkspaceContext,
  input: {
    snapshotId: string;
    extracted: ExtractedPage;
    freshness: FreshnessResult;
    intent: KeywordIntent;
  },
): Promise<void> {
  await scopedDb(ctx).pageObservation.create({
    data: {
      workspaceId: ctx.workspaceId,
      snapshotId: input.snapshotId,
      title: input.extracted.title,
      description: input.extracted.description,
      headings: input.extracted.headings,
      wordCount: input.extracted.wordCount,
      internalLinks: input.extracted.internalLinks,
      externalLinks: input.extracted.externalLinks,
      mediaCounts: input.extracted.mediaCounts,
      publishedAt: input.freshness.publishedAt,
      modifiedAt: input.freshness.modifiedAt,
      freshnessConfidence: input.freshness.confidence,
      intent: input.intent,
    },
  });
}

export async function persistSchemaObservations(
  ctx: WorkspaceContext,
  snapshotId: string,
  results: SchemaValidationResult[],
): Promise<void> {
  if (results.length === 0) return;
  await scopedDb(ctx).schemaObservation.createMany({
    data: results.map((result) => ({
      workspaceId: ctx.workspaceId,
      snapshotId,
      type: result.type,
      valid: result.valid,
      mismatches: result.mismatches,
    })),
  });
}

export async function persistPerformanceObservation(
  ctx: WorkspaceContext,
  snapshotId: string,
  metrics: { lcp: number | null; inp: number | null; cls: number | null },
  source: PerformanceSource,
): Promise<void> {
  await scopedDb(ctx).performanceObservation.create({
    data: {
      workspaceId: ctx.workspaceId,
      snapshotId,
      lcp: metrics.lcp,
      inp: metrics.inp,
      cls: metrics.cls,
      source,
    },
  });
}

export async function listPageSnapshotsForCrawlRun(
  ctx: WorkspaceContext,
  crawlRunId: string,
): Promise<PageSnapshotDetailDto[]> {
  const snapshots = await scopedDb(ctx).pageSnapshot.findMany({
    where: { crawlRunId },
    include: { observation: true, schemas: true, performance: true },
    orderBy: { fetchedAt: "desc" },
  });

  return snapshots.map((snapshot) => ({
    ...toSnapshotDto(snapshot),
    observation: snapshot.observation
      ? toObservationDto(snapshot.observation)
      : null,
    schemas: snapshot.schemas.map(toSchemaDto),
    performance: snapshot.performance.map(toPerformanceDto),
  }));
}

export async function getPageSnapshot(
  ctx: WorkspaceContext,
  snapshotId: string,
): Promise<PageSnapshotDetailDto | null> {
  const snapshot = await scopedDb(ctx).pageSnapshot.findFirst({
    where: { id: snapshotId },
    include: { observation: true, schemas: true, performance: true },
  });
  if (!snapshot) return null;

  return {
    ...toSnapshotDto(snapshot),
    observation: snapshot.observation
      ? toObservationDto(snapshot.observation)
      : null,
    schemas: snapshot.schemas.map(toSchemaDto),
    performance: snapshot.performance.map(toPerformanceDto),
  };
}
