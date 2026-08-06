import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/context";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("benchmark and prompts services", () => {
  let brandService: typeof import("@/lib/brands/service");
  let marketService: typeof import("@/lib/markets/service");
  let promptService: typeof import("@/lib/prompts/service");
  let benchmarkService: typeof import("@/lib/benchmark/service");
  let operationService: typeof import("@/lib/operations/service");
  let database: (typeof import("@/lib/db"))["db"];
  let ctx: WorkspaceContext;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    brandService = await import("@/lib/brands/service");
    marketService = await import("@/lib/markets/service");
    promptService = await import("@/lib/prompts/service");
    benchmarkService = await import("@/lib/benchmark/service");
    operationService = await import("@/lib/operations/service");
    database = (await import("@/lib/db")).db;

    const workspace = await database.workspace.create({
      data: {
        name: `Benchmark Service Test ${suffix}`,
        slug: `benchmark-service-test-${suffix}`,
      },
    });
    ctx = { workspaceId: workspace.id, userId: null, role: "OWNER" };
  });

  afterAll(async () => {
    await database.brand.deleteMany({
      where: { domain: { endsWith: `.test` } },
    });
    await database.market.deleteMany({
      where: { workspaceId: ctx.workspaceId },
    });
    await database.workspace.deleteMany({
      where: { slug: `benchmark-service-test-${suffix}` },
    });
    await database.$disconnect();
  });

  async function createActiveBrand(name: string) {
    const draft = await brandService.createBrand(ctx, {
      name,
      websiteUrl: `https://${name.toLowerCase()}-${suffix}.test`,
      description: "A disposable integration-test SaaS project.",
      category: "Integration test software",
      competitors: [],
    });
    const market = await marketService.findOrCreateMarket(ctx, {
      country: "US",
      language: "en",
      timezone: "America/Los_Angeles",
    });
    await brandService.setBrandMarket(ctx, draft.id, {
      defaultMarketId: market.id,
      timezone: "America/Los_Angeles",
    });
    return brandService.activateBrand(ctx, draft.id);
  }

  it("rejects batch creation when the project has no active prompts", async () => {
    const brand = await createActiveBrand(`Empty${suffix}`);
    const operation = await operationService.createOperation(ctx, {
      kind: "BENCHMARK_BATCH",
      brandId: brand.id,
    });

    await expect(
      benchmarkService.createBatch(ctx, {
        brandId: brand.id,
        marketId: brand.defaultMarketId as string,
        operationId: operation.id,
        repetitions: 1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("runs a batch end to end: creation, run lifecycle, aggregate, partial failure", async () => {
    const brand = await createActiveBrand(`Runner${suffix}`);

    const promptA = await promptService.createPrompt(ctx, {
      brandId: brand.id,
      marketId: brand.defaultMarketId as string,
      text: "What is the best AI visibility tool for a SaaS team?",
      type: "CATEGORY",
    });
    const promptB = await promptService.createPrompt(ctx, {
      brandId: brand.id,
      marketId: brand.defaultMarketId as string,
      text: `What does ${brand.name} do?`,
      type: "BRAND_SPECIFIC",
    });

    const operation = await operationService.createOperation(ctx, {
      kind: "BENCHMARK_BATCH",
      brandId: brand.id,
    });

    const { batch, runCount } = await benchmarkService.createBatch(ctx, {
      brandId: brand.id,
      marketId: brand.defaultMarketId as string,
      operationId: operation.id,
      repetitions: 1,
    });
    expect(runCount).toBe(2);
    expect(batch.totalRuns).toBe(2);
    expect(batch.promptSetHash).toMatch(/^[0-9a-f]{64}$/);

    const beforeRun = await benchmarkService.getBatch(ctx, batch.id);
    expect(beforeRun?.runs).toHaveLength(2);
    expect(beforeRun?.runs.every((run) => run.status === "PENDING")).toBe(true);

    const runForA = beforeRun?.runs.find((run) => run.promptId === promptA.id);
    const runForB = beforeRun?.runs.find((run) => run.promptId === promptB.id);
    if (!runForA || !runForB) throw new Error("expected both runs to exist");

    // Simulate what benchmarkRunExecute would do for a successful run.
    await benchmarkService.markRunRunning(ctx, runForA.id);
    await benchmarkService.markRunCompleted(ctx, runForA.id, {
      providerRequestId: "req-1",
      responseText: `${brand.name} is a strong option for this.`,
      inputTokens: 42,
      outputTokens: 18,
      totalTokens: 60,
      providerCallId: null,
      analysis: {
        brandMentioned: true,
        mentionCount: 1,
        firstMentionCharIndex: 0,
        position: 1,
        competitorMentions: {},
        refused: false,
      },
      sentiment: "POSITIVE",
    });
    await benchmarkService.incrementBatchCounter(
      ctx,
      batch.id,
      "completedRuns",
    );

    // Simulate what onFailure would do for a permanently-failed run.
    await benchmarkService.markRunFailed(ctx, runForB.id, {
      errorCode: "PROVIDER_ERROR",
      errorMessage: "Simulated provider failure.",
    });
    await benchmarkService.incrementBatchCounter(ctx, batch.id, "failedRuns");

    const { batch: finalizedBatch, aggregate } =
      await benchmarkService.finalizeBatch(ctx, batch.id);
    expect(finalizedBatch.status).toBe("PARTIAL_FAILURE");
    expect(aggregate.sampleSize).toBe(1);
    expect(aggregate.failedCount).toBe(1);
    expect(aggregate.visibility).toBe(1);

    const detail = await benchmarkService.getBatch(ctx, batch.id);
    expect(detail?.aggregate?.visibility).toBe(1);
    const completed = detail?.runs.find((run) => run.id === runForA.id);
    expect(completed?.analysis?.sentiment).toBe("POSITIVE");
    const failed = detail?.runs.find((run) => run.id === runForB.id);
    expect(failed?.status).toBe("FAILED");
    expect(failed?.errorCode).toBe("PROVIDER_ERROR");

    // activateBrand() only transitions DRAFT projects — the latest-aggregate
    // lookup used by the overview page should find this batch's result.
    const latest = await benchmarkService.getLatestAggregate(ctx, brand.id);
    expect(latest?.batch.id).toBe(batch.id);
  });

  it("prompt CRUD: create, list, update stamps approval, delete", async () => {
    const brand = await createActiveBrand(`Crud${suffix}`);

    const created = await promptService.createPrompt(ctx, {
      brandId: brand.id,
      marketId: brand.defaultMarketId as string,
      text: "What tools help track AI visibility?",
      type: "CATEGORY",
    });
    expect(created.source).toBe("USER_ADDED");
    expect(created.approvedAt).not.toBeNull();

    const generatedCount = await promptService.bulkCreateGeneratedPrompts(ctx, {
      brandId: brand.id,
      marketId: brand.defaultMarketId as string,
      prompts: [
        { text: "An AI-generated prompt one.", type: "USE_CASE" },
        { text: "An AI-generated prompt two.", type: "COMPARISON" },
      ],
    });
    expect(generatedCount).toBe(2);

    // Re-running with an overlapping prompt is idempotent via @@unique([brandId, text]).
    const repeatCount = await promptService.bulkCreateGeneratedPrompts(ctx, {
      brandId: brand.id,
      marketId: brand.defaultMarketId as string,
      prompts: [{ text: "An AI-generated prompt one.", type: "USE_CASE" }],
    });
    expect(repeatCount).toBe(0);

    const all = await promptService.listPrompts(ctx, brand.id);
    expect(all).toHaveLength(3);
    const unapproved = all.find((prompt) => prompt.source === "AI_GENERATED");
    expect(unapproved?.approvedAt).toBeNull();

    const updated = await promptService.updatePrompt(ctx, created.id, {
      isActive: false,
    });
    expect(updated.isActive).toBe(false);

    const active = await promptService.listActivePrompts(ctx, brand.id);
    expect(active.some((prompt) => prompt.id === created.id)).toBe(false);

    const { deletedId } = await promptService.deletePrompt(ctx, created.id);
    expect(deletedId).toBe(created.id);
    await expect(
      promptService.updatePrompt(ctx, created.id, { isActive: true }),
    ).rejects.toMatchObject({ code: "PROMPT_NOT_FOUND" });
  });
});
