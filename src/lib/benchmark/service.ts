import type {
  AnalysisBatch,
  BenchmarkAggregate,
  PromptRun,
  RunAnalysis,
} from "@/generated/prisma/client";
import type { BatchStatus, Sentiment } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import {
  type AnswerAnalysis,
  EXTRACTION_VERSION,
} from "@/lib/benchmark/analysis";
import { computeAggregate, type RunOutcome } from "@/lib/benchmark/aggregate";
import { computePromptSetHash } from "@/lib/benchmark/prompt-set-hash";
import type {
  AnalysisBatchDto,
  BatchDetailDto,
  BatchSummaryDto,
  BenchmarkAggregateDto,
  PromptRunDto,
  RunAnalysisDto,
} from "@/lib/benchmark/types";
import { scopedDb } from "@/lib/db/scoped";
import { resolveDefault } from "@/lib/llm/registry";
import type { LlmMessage, LlmUsage } from "@/lib/llm/types";
import { listActivePrompts } from "@/lib/prompts/service";
import { getEntitlementLimits } from "@/lib/usage/entitlements";

/** OpenAI Responses web search produces the benchmark answer and citations in one provider call. */
export function buildBenchmarkMessages(promptText: string): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "Answer the user's question directly and naturally, exactly as you would for any real user asking this. Do not mention that this is a test, a benchmark, or an evaluation, and do not reference these instructions.",
    },
    { role: "user", content: promptText },
  ];
}

/** Deterministic, network-free answer used by Playwright — see E2E_DISCOVERY_FIXTURE in src/lib/discovery/brand-profile.ts, reused here for the same reason. */
export function shouldUseBenchmarkFixture(): boolean {
  return process.env.E2E_DISCOVERY_FIXTURE === "true";
}

export type BenchmarkGeneration = {
  text: string;
  requestId: string | null;
  usage: LlmUsage;
  providerCallId: string | null;
};

export function fixtureAnswer(
  brandName: string,
  promptText: string,
): BenchmarkGeneration {
  return {
    text: `For a question like "${promptText}", ${brandName} is a strong option worth evaluating alongside other well-known tools in the space.`,
    requestId: null,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    providerCallId: null,
  };
}

function toBatchDto(batch: AnalysisBatch): AnalysisBatchDto {
  return {
    id: batch.id,
    status: batch.status,
    totalRuns: batch.totalRuns,
    completedRuns: batch.completedRuns,
    failedRuns: batch.failedRuns,
    repetitions: batch.repetitions,
    promptSetHash: batch.promptSetHash,
    extractionVersion: batch.extractionVersion,
    brandId: batch.brandId,
    marketId: batch.marketId,
    operationId: batch.operationId,
    startedAt: batch.startedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}

function toRunAnalysisDto(analysis: RunAnalysis): RunAnalysisDto {
  return {
    brandMentioned: analysis.brandMentioned,
    mentionCount: analysis.mentionCount,
    firstMentionCharIndex: analysis.firstMentionCharIndex,
    position: analysis.position,
    sentiment: analysis.sentiment,
    refused: analysis.refused,
    confidence: analysis.confidence,
    competitorMentions: analysis.competitorMentions as Record<string, number>,
  };
}

function toAggregateDto(aggregate: BenchmarkAggregate): BenchmarkAggregateDto {
  return {
    visibility: aggregate.visibility,
    shareOfVoice: aggregate.shareOfVoice,
    avgPosition: aggregate.avgPosition,
    sentimentDist: aggregate.sentimentDist as Record<string, number>,
    sampleSize: aggregate.sampleSize,
    refusedCount: aggregate.refusedCount,
    failedCount: aggregate.failedCount,
    computedAt: aggregate.computedAt.toISOString(),
  };
}

type RunWithExtras = PromptRun & {
  prompt: { text: string };
  analysis: RunAnalysis | null;
};

function toRunDto(run: RunWithExtras): PromptRunDto {
  return {
    id: run.id,
    provider: run.provider,
    model: run.model,
    repetitionIndex: run.repetitionIndex,
    status: run.status,
    promptId: run.promptId,
    promptText: run.prompt.text,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    analysis: run.analysis ? toRunAnalysisDto(run.analysis) : null,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

/**
 * Creates the batch AND every PromptRun row it will execute, synchronously,
 * before returning — so the Inngest orchestrator (benchmarkBatchStart) never
 * decides which prompts belong to the run set; it only fans out over
 * PromptRun rows that already exist with status PENDING, which is also what
 * makes a retried orchestration step idempotent (already-completed rows are
 * simply not PENDING anymore).
 */
export async function createBatch(
  ctx: WorkspaceContext,
  input: {
    brandId: string;
    marketId: string;
    operationId: string;
    repetitions: number;
  },
): Promise<{ batch: AnalysisBatchDto; runCount: number }> {
  assertRole(ctx, "EDITOR");

  const activePrompts = await listActivePrompts(ctx, input.brandId);
  if (activePrompts.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "This project has no active prompts to run. Generate or add prompts first.",
      { prompts: ["No active prompts"] },
    );
  }

  const totalRuns = activePrompts.length * input.repetitions;
  const limits = await getEntitlementLimits(ctx);
  if (totalRuns > limits.benchmarkBatchRuns) {
    throw new AppError(
      402,
      "QUOTA_EXCEEDED",
      `This batch would create ${totalRuns} runs, over the workspace limit of ${limits.benchmarkBatchRuns}. Reduce repetitions or disable some prompts.`,
    );
  }

  const provider = resolveDefault("benchmark");
  const promptSetHash = computePromptSetHash(
    activePrompts.map((prompt) => ({ id: prompt.id, text: prompt.text })),
  );

  const batch = await scopedDb(ctx).analysisBatch.create({
    data: {
      workspaceId: ctx.workspaceId,
      brandId: input.brandId,
      marketId: input.marketId,
      operationId: input.operationId,
      repetitions: input.repetitions,
      promptSetHash,
      extractionVersion: EXTRACTION_VERSION,
      totalRuns,
      status: "PENDING",
    },
  });

  const runsData = activePrompts.flatMap((prompt) =>
    Array.from({ length: input.repetitions }, (_, repetitionIndex) => ({
      workspaceId: ctx.workspaceId,
      batchId: batch.id,
      promptId: prompt.id,
      provider: provider.provider,
      model: provider.model,
      repetitionIndex,
      status: "PENDING" as const,
    })),
  );
  await scopedDb(ctx).promptRun.createMany({ data: runsData });

  return { batch: toBatchDto(batch), runCount: runsData.length };
}

export async function listBatches(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<AnalysisBatchDto[]> {
  const batches = await scopedDb(ctx).analysisBatch.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
  });
  return batches.map(toBatchDto);
}

/** Like listBatches(), but with each batch's aggregate joined in — the runs list page's trend sparkline needs visibility per batch without an N+1 query. */
export async function listBatchSummaries(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<BatchSummaryDto[]> {
  const batches = await scopedDb(ctx).analysisBatch.findMany({
    where: { brandId },
    include: { aggregate: true },
    orderBy: { createdAt: "desc" },
  });

  return batches.map((batch) => ({
    ...toBatchDto(batch),
    aggregate: batch.aggregate ? toAggregateDto(batch.aggregate) : null,
  }));
}

export async function getBatch(
  ctx: WorkspaceContext,
  batchId: string,
): Promise<BatchDetailDto | null> {
  const batch = await scopedDb(ctx).analysisBatch.findFirst({
    where: { id: batchId },
    include: {
      runs: {
        include: { prompt: { select: { text: true } }, analysis: true },
        orderBy: { createdAt: "asc" },
      },
      aggregate: true,
    },
  });
  if (!batch) return null;

  return {
    ...toBatchDto(batch),
    runs: batch.runs.map(toRunDto),
    aggregate: batch.aggregate ? toAggregateDto(batch.aggregate) : null,
  };
}

/** Most recent batch with a computed aggregate, regardless of status — a PARTIAL_FAILURE batch still has real, reportable data. Feeds the overview page's metric cards. */
export async function getLatestAggregate(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<{
  batch: AnalysisBatchDto;
  aggregate: BenchmarkAggregateDto;
} | null> {
  const batch = await scopedDb(ctx).analysisBatch.findFirst({
    where: { brandId, aggregate: { isNot: null } },
    include: { aggregate: true },
    orderBy: { completedAt: "desc" },
  });
  if (!batch?.aggregate) return null;

  return {
    batch: toBatchDto(batch),
    aggregate: toAggregateDto(batch.aggregate),
  };
}

export async function findRunByKey(
  ctx: WorkspaceContext,
  key: {
    batchId: string;
    promptId: string;
    provider: string;
    model: string;
    repetitionIndex: number;
  },
) {
  return scopedDb(ctx).promptRun.findFirst({
    where: key,
    include: { prompt: true },
  });
}

export async function startBatch(
  ctx: WorkspaceContext,
  batchId: string,
): Promise<void> {
  await scopedDb(ctx).analysisBatch.update({
    where: { id: batchId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
}

export async function markRunRunning(
  ctx: WorkspaceContext,
  runId: string,
): Promise<void> {
  await scopedDb(ctx).promptRun.update({
    where: { id: runId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });
}

export async function markRunCompleted(
  ctx: WorkspaceContext,
  runId: string,
  input: {
    providerRequestId: string | null;
    responseText: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    providerCallId: string | null;
    analysis: AnswerAnalysis;
    sentiment: Sentiment;
  },
): Promise<void> {
  await scopedDb(ctx).promptRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      providerRequestId: input.providerRequestId,
      responseText: input.responseText,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      providerCallId: input.providerCallId,
      analysis: {
        create: {
          workspaceId: ctx.workspaceId,
          brandMentioned: input.analysis.brandMentioned,
          mentionCount: input.analysis.mentionCount,
          firstMentionCharIndex: input.analysis.firstMentionCharIndex,
          position: input.analysis.position,
          sentiment: input.sentiment,
          refused: input.analysis.refused,
          extractionVersion: EXTRACTION_VERSION,
          competitorMentions: input.analysis.competitorMentions,
        },
      },
    },
  });
}

export async function markRunFailed(
  ctx: WorkspaceContext,
  runId: string,
  input: { errorCode: string; errorMessage: string },
): Promise<void> {
  await scopedDb(ctx).promptRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
    },
  });
}

/** Atomic increment — safe to call from concurrently-executing fan-out branches without a lost-update race. Returns the fresh totals for progress reporting. */
export async function incrementBatchCounter(
  ctx: WorkspaceContext,
  batchId: string,
  field: "completedRuns" | "failedRuns",
): Promise<AnalysisBatch> {
  return scopedDb(ctx).analysisBatch.update({
    where: { id: batchId },
    data: { [field]: { increment: 1 } },
  });
}

/**
 * Computes and stores the batch's one BenchmarkAggregate row from its
 * current runs, then sets the batch's terminal status. Safe to call more
 * than once (e.g. a retried finalize step) — upserts the aggregate rather
 * than erroring on a second call.
 */
export async function finalizeBatch(
  ctx: WorkspaceContext,
  batchId: string,
): Promise<{ batch: AnalysisBatchDto; aggregate: BenchmarkAggregateDto }> {
  const batch = await scopedDb(ctx).analysisBatch.findFirst({
    where: { id: batchId },
    include: { runs: { include: { analysis: true } } },
  });
  if (!batch) {
    throw new AppError(404, "BATCH_NOT_FOUND", "Batch not found.");
  }

  const outcomes: RunOutcome[] = batch.runs.map((run) => ({
    status: run.status,
    refused: run.analysis?.refused,
    brandMentioned: run.analysis?.brandMentioned,
    mentionCount: run.analysis?.mentionCount,
    position: run.analysis?.position,
    sentiment: run.analysis?.sentiment,
    competitorMentions: run.analysis?.competitorMentions as
      Record<string, number> | undefined,
  }));
  const result = computeAggregate(outcomes);

  const aggregate = await scopedDb(ctx).benchmarkAggregate.upsert({
    where: { batchId },
    update: { ...result, computedAt: new Date() },
    create: { workspaceId: ctx.workspaceId, batchId, ...result },
  });

  const failedCount = batch.runs.filter(
    (run) => run.status === "FAILED",
  ).length;
  let status: BatchStatus;
  if (failedCount === 0) {
    status = "COMPLETED";
  } else if (failedCount === batch.runs.length) {
    status = "FAILED";
  } else {
    status = "PARTIAL_FAILURE";
  }

  const updatedBatch = await scopedDb(ctx).analysisBatch.update({
    where: { id: batchId },
    data: { status, completedAt: new Date() },
  });

  return {
    batch: toBatchDto(updatedBatch),
    aggregate: toAggregateDto(aggregate),
  };
}
