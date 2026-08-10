import { NonRetriableError } from "inngest";

import type { WorkspaceContext } from "@/lib/auth/context";
import {
  buildBenchmarkMessages,
  findRunByKey,
  finalizeBatch,
  fixtureAnswer,
  incrementBatchCounter,
  markRunCompleted,
  markRunFailed,
  markRunRunning,
  refreshBatchAggregate,
  shouldUseBenchmarkFixture,
  startBatch,
  type BenchmarkGeneration,
} from "@/lib/benchmark/service";
import { analyzeAnswer } from "@/lib/benchmark/analysis";
import {
  buildEntitySentimentJudgeRequest,
  DEFAULT_SENTIMENT,
} from "@/lib/benchmark/sentiment";
import { scopedDb } from "@/lib/db/scoped";
import { chunk } from "@/lib/inngest/chunk";
import { inngest } from "@/lib/inngest/client";
import {
  benchmarkBatchCompleted,
  benchmarkBatchRequested,
  benchmarkRunRequested,
} from "@/lib/inngest/events";
import { getProvider } from "@/lib/llm/registry";
import type { Sentiment } from "@/generated/prisma/enums";
import { childLogger } from "@/lib/observability/logger";
import {
  advanceOperation,
  completeOperation,
  failOperation,
  partialOperation,
  startOperation,
} from "@/lib/operations/service";
import { withProviderCall } from "@/lib/providers/instrument";
import { recordUsage, USAGE_METERS } from "@/lib/usage/ledger";

type EntitySentimentOutcome = {
  brand: Sentiment;
  competitors: Record<string, Sentiment>;
};

/**
 * Executes exactly one PromptRun: generate an answer, extract mentions with
 * the pure analyzer, optionally judge sentiment, persist, advance progress.
 * Triggered two ways — directly via benchmarkBatchStart's step.invoke (the
 * normal path) or, since it is a regular event-triggered function, by
 * sending `benchmark/run.requested` directly (useful for retrying a single
 * run without re-running the whole batch).
 */
export const benchmarkRunExecute = inngest.createFunction(
  {
    id: "benchmark-run-execute",
    triggers: [{ event: benchmarkRunRequested }],
    concurrency: [
      { key: "event.data.workspaceId", limit: 8 },
      { key: "event.data.provider", limit: 20, scope: "account" },
    ],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data;
      const ctx: WorkspaceContext = {
        workspaceId: original.workspaceId,
        userId: null,
        role: "OWNER",
      };
      const run = await findRunByKey(ctx, original);
      if (!run) return;

      await markRunFailed(ctx, run.id, {
        errorCode: "PROVIDER_ERROR",
        errorMessage: error.message,
      });
      const updated = await incrementBatchCounter(
        ctx,
        original.batchId,
        "failedRuns",
      );
      const batch = await scopedDb(ctx).analysisBatch.findFirst({
        where: { id: original.batchId },
        select: { operationId: true },
      });
      if (batch) {
        await advanceOperation(ctx, batch.operationId, {
          progressCurrent: updated.completedRuns + updated.failedRuns,
          progressTotal: updated.totalRuns,
        });
      }
    },
  },
  async ({ event, step }) => {
    const {
      workspaceId,
      batchId,
      promptId,
      provider: providerName,
      model,
      repetitionIndex,
    } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };

    const run = await step.run("find-run", () =>
      findRunByKey(ctx, {
        batchId,
        promptId,
        provider: providerName,
        model,
        repetitionIndex,
      }),
    );
    if (!run) {
      throw new NonRetriableError(
        `PromptRun not found for batch ${batchId}, prompt ${promptId}, repetition ${repetitionIndex}.`,
      );
    }

    await step.run("mark-running", () => markRunRunning(ctx, run.id));

    const context = await step.run("load-context", async () => {
      const batch = await scopedDb(ctx).analysisBatch.findFirstOrThrow({
        where: { id: batchId },
      });
      const brand = await scopedDb(ctx).brand.findFirstOrThrow({
        where: { id: batch.brandId },
        include: {
          competitors: {
            where: {
              status: { in: ["ACCEPTED", "PINNED"] },
              OR: [{ tier: "TOP" }, { tier: null }],
            },
            orderBy: { createdAt: "asc" },
            take: 30,
          },
        },
      });

      return {
        operationId: batch.operationId,
        brandName: brand.name,
        promptText: run.prompt.text,
        aliases: [
          brand.name,
          ...((run.prompt.aliasSet as string[] | null) ?? []),
        ],
        competitors: brand.competitors.map((competitor) => ({
          id: competitor.id,
          name: competitor.name,
          aliases: [competitor.name],
        })),
      };
    });

    const generation = await step.run(
      "generate-answer",
      async (): Promise<BenchmarkGeneration> => {
        if (shouldUseBenchmarkFixture()) {
          return fixtureAnswer(context.brandName, context.promptText);
        }
        if (!process.env.OPENAI_API_KEY) {
          throw new NonRetriableError(
            "Benchmark runs are not configured. Add OPENAI_API_KEY and try again.",
          );
        }

        const provider = getProvider(providerName);
        const result = await withProviderCall(
          ctx,
          {
            capability: "BENCHMARK",
            provider: provider.provider,
            model: provider.model,
            operationId: context.operationId,
          },
          () =>
            provider.generateText({
              messages: buildBenchmarkMessages(context.promptText),
              webSearch: true,
            }),
        );

        const providerCall = await scopedDb(ctx).providerCall.findFirst({
          where: { requestId: result.requestId, provider: provider.provider },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        return {
          text: result.content,
          requestId: result.requestId,
          usage: result.usage,
          providerCallId: providerCall?.id ?? null,
        };
      },
    );

    const analysis = analyzeAnswer(
      generation.text,
      context.aliases,
      context.competitors,
    );

    const sentiments = await step.run(
      "judge-sentiment",
      async (): Promise<EntitySentimentOutcome> => {
        const defaults: EntitySentimentOutcome = {
          brand: DEFAULT_SENTIMENT,
          competitors: {},
        };
        if (analysis.refused) return defaults;

        const entities: Array<{ id: string; name: string }> = [];
        if (analysis.brandMentioned) {
          entities.push({ id: "__brand__", name: context.brandName });
        }
        for (const competitor of context.competitors) {
          if ((analysis.competitorMentions[competitor.id]?.count ?? 0) > 0) {
            entities.push({ id: competitor.id, name: competitor.name });
            defaults.competitors[competitor.id] = DEFAULT_SENTIMENT;
          }
        }
        if (entities.length === 0) return defaults;
        if (shouldUseBenchmarkFixture() || !process.env.OPENAI_API_KEY)
          return defaults;

        try {
          const provider = getProvider(providerName);
          const result = await withProviderCall(
            ctx,
            {
              capability: "BENCHMARK",
              provider: provider.provider,
              model: provider.model,
              operationId: context.operationId,
            },
            () =>
              provider.generateJson(
                buildEntitySentimentJudgeRequest(generation.text, entities),
              ),
          );
          const allowedIds = new Set(entities.map((entity) => entity.id));
          for (const item of result.content.sentiments) {
            if (!allowedIds.has(item.id)) continue;
            if (item.id === "__brand__") defaults.brand = item.sentiment;
            else defaults.competitors[item.id] = item.sentiment;
          }
          return defaults;
        } catch {
          // Sentiment is supplementary, not core to visibility measurement —
          // a judge-call failure must never fail an otherwise-successful run.
          return defaults;
        }
      },
    );

    for (const [competitorId, sentiment] of Object.entries(
      sentiments.competitors,
    )) {
      const entry = analysis.competitorMentions[competitorId];
      if (entry) entry.sentiment = sentiment;
    }

    await step.run("persist-analysis", async () => {
      await markRunCompleted(ctx, run.id, {
        providerRequestId: generation.requestId,
        responseText: generation.text,
        inputTokens: generation.usage.inputTokens,
        outputTokens: generation.usage.outputTokens,
        totalTokens: generation.usage.totalTokens,
        providerCallId: generation.providerCallId,
        analysis,
        sentiment: sentiments.brand,
      });

      await recordUsage(ctx, {
        meter: USAGE_METERS.BENCHMARK_INPUT_TOKENS,
        quantity: generation.usage.inputTokens,
        operationId: context.operationId,
        idempotencyKey: `${batchId}:${promptId}:${repetitionIndex}:input-tokens`,
      });
      await recordUsage(ctx, {
        meter: USAGE_METERS.BENCHMARK_OUTPUT_TOKENS,
        quantity: generation.usage.outputTokens,
        operationId: context.operationId,
        idempotencyKey: `${batchId}:${promptId}:${repetitionIndex}:output-tokens`,
      });
    });

    const updated = await step.run("advance-progress", () =>
      incrementBatchCounter(ctx, batchId, "completedRuns"),
    );
    await step.run("advance-operation", () =>
      advanceOperation(ctx, context.operationId, {
        progressCurrent: updated.completedRuns + updated.failedRuns,
        progressTotal: updated.totalRuns,
      }),
    );

    return { runId: run.id };
  },
);

const FANOUT_CHUNK_SIZE = 4;

/**
 * Orchestrates a batch: fans out over every PENDING PromptRun in bounded
 * parallel groups via step.invoke (each independently retried by Inngest),
 * then finalizes the aggregate once every group has settled. Uses
 * Promise.allSettled, not Promise.all, per group — one run's terminal
 * failure must not abort the rest of the batch or later groups; a partial
 * result with reduced confidence is a real outcome, never a silent gap. See
 * OperationStatus.PARTIAL in docs/events.md.
 */
export const benchmarkBatchStart = inngest.createFunction(
  {
    id: "benchmark-batch-start",
    triggers: [{ event: benchmarkBatchRequested }],
    concurrency: { key: "event.data.workspaceId", limit: 2 },
    retries: 2,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data;
      const ctx: WorkspaceContext = {
        workspaceId: original.workspaceId,
        userId: null,
        role: "OWNER",
      };
      const batch = await scopedDb(ctx).analysisBatch.findFirst({
        where: { id: original.batchId },
        select: { operationId: true },
      });
      if (batch) {
        await failOperation(ctx, batch.operationId, {
          errorCode: "BENCHMARK_FAILED",
          errorMessage: error.message,
        });
      }
    },
  },
  async ({ event, step }) => {
    const { workspaceId, batchId } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };
    const log = childLogger({
      batchId,
      workspaceId,
      fn: "benchmarkBatchStart",
    });

    const batch = await step.run("load-batch", () =>
      scopedDb(ctx).analysisBatch.findFirstOrThrow({ where: { id: batchId } }),
    );

    await step.run("start", async () => {
      await startOperation(ctx, batch.operationId);
      await startBatch(ctx, batchId);
    });

    const pendingRuns = await step.run("load-pending-runs", () =>
      scopedDb(ctx).promptRun.findMany({
        where: { batchId, status: "PENDING" },
        select: {
          promptId: true,
          provider: true,
          model: true,
          repetitionIndex: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    );

    const groups = chunk(pendingRuns, FANOUT_CHUNK_SIZE);
    for (const [groupIndex, group] of groups.entries()) {
      await Promise.allSettled(
        group.map((run) =>
          step.invoke(`run-${run.promptId}-${run.repetitionIndex}`, {
            function: benchmarkRunExecute,
            data: {
              workspaceId,
              batchId,
              promptId: run.promptId,
              provider: run.provider,
              model: run.model,
              repetitionIndex: run.repetitionIndex,
            },
          }),
        ),
      );

      // Publish a trustworthy partial aggregate after every parallel wave.
      // The onboarding page can render useful metrics after the first eight
      // answers instead of holding everything behind the slowest of all runs.
      const snapshot = await step.run(
        `publish-snapshot-${groupIndex + 1}`,
        () => refreshBatchAggregate(ctx, batchId),
      );
      await step.run(`announce-snapshot-${groupIndex + 1}`, () =>
        advanceOperation(ctx, batch.operationId, {
          progressCurrent: snapshot.sampleSize + snapshot.failedCount,
          progressTotal: batch.totalRuns,
          metadata: {
            batchId,
            brandId: batch.brandId,
            partialSampleSize: snapshot.sampleSize,
          },
        }),
      );
    }

    const finalized = await step.run("finalize", () =>
      finalizeBatch(ctx, batchId),
    );

    await step.run("complete-operation", async () => {
      if (finalized.batch.status === "COMPLETED") {
        await completeOperation(ctx, batch.operationId, {
          metadata: { batchId, brandId: batch.brandId },
        });
      } else if (finalized.batch.status === "FAILED") {
        await failOperation(ctx, batch.operationId, {
          errorCode: "BENCHMARK_FAILED",
          errorMessage: `All ${finalized.batch.totalRuns} runs failed.`,
        });
      } else {
        await partialOperation(ctx, batch.operationId, {
          errorCode: "PARTIAL_BATCH_FAILURE",
          errorMessage: `${finalized.batch.failedRuns} of ${finalized.batch.totalRuns} runs failed.`,
          metadata: { batchId, brandId: batch.brandId },
        });
      }
    });

    await step.sendEvent(
      "notify-batch-completed",
      benchmarkBatchCompleted.create({ workspaceId, batchId }),
    );

    log.info({ status: finalized.batch.status }, "benchmark batch finished");

    return { batchId, status: finalized.batch.status };
  },
);
