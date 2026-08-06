import { NonRetriableError } from "inngest";

import type { WorkspaceContext } from "@/lib/auth/context";
import { inngest } from "@/lib/inngest/client";
import { promptsGenerationRequested } from "@/lib/inngest/events";
import { resolveDefault } from "@/lib/llm/registry";
import { childLogger } from "@/lib/observability/logger";
import {
  completeOperation,
  failOperation,
  startOperation,
} from "@/lib/operations/service";
import {
  buildPromptGenerationRequest,
  fixturePrompts,
  shouldUsePromptGenerationFixture,
  type GeneratedPrompts,
} from "@/lib/prompts/generator";
import { bulkCreateGeneratedPrompts } from "@/lib/prompts/service";
import { withProviderCall } from "@/lib/providers/instrument";
import { scopedDb } from "@/lib/db/scoped";
import { recordUsage, USAGE_METERS } from "@/lib/usage/ledger";

/**
 * AI-drafted prompts land unapproved (Prompt.approvedAt null) — a human
 * reviews them from the Prompts page. See src/lib/prompts/service.ts.
 */
export const promptGeneration = inngest.createFunction(
  {
    id: "prompt-generation",
    triggers: [{ event: promptsGenerationRequested }],
    concurrency: { key: "event.data.workspaceId", limit: 2 },
    retries: 3,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data;
      const ctx: WorkspaceContext = {
        workspaceId: original.workspaceId,
        userId: null,
        role: "OWNER",
      };
      await failOperation(ctx, original.operationId, {
        errorCode: "PROMPT_GENERATION_FAILED",
        errorMessage: error.message,
      });
    },
  },
  async ({ event, step }) => {
    const { workspaceId, brandId, operationId } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };
    const log = childLogger({
      operationId,
      workspaceId,
      fn: "promptGeneration",
    });

    await step.run("start-operation", () => startOperation(ctx, operationId));

    const context = await step.run("load-context", async () => {
      const brand = await scopedDb(ctx).brand.findFirstOrThrow({
        where: { id: brandId, status: "ACTIVE" },
        include: {
          competitors: { where: { status: { in: ["ACCEPTED", "PINNED"] } } },
        },
      });
      if (!brand.defaultMarketId) {
        throw new NonRetriableError(
          "This project has no market configured yet.",
        );
      }
      const market = await scopedDb(ctx).market.findFirstOrThrow({
        where: { id: brand.defaultMarketId },
      });

      return {
        marketId: market.id,
        input: {
          brand: {
            name: brand.name,
            description: brand.description,
            category: brand.category,
          },
          competitors: brand.competitors.map((competitor) => ({
            name: competitor.name,
          })),
          market: { language: market.language, country: market.country },
        },
      };
    });

    const generated = await step.run(
      "llm-generate",
      async (): Promise<{
        prompts: GeneratedPrompts["prompts"];
        inputTokens: number;
        outputTokens: number;
      }> => {
        if (shouldUsePromptGenerationFixture()) {
          return {
            ...fixturePrompts(context.input),
            inputTokens: 0,
            outputTokens: 0,
          };
        }

        if (!process.env.ZAI_API_KEY) {
          throw new NonRetriableError(
            "Automatic prompt generation is not configured. Add ZAI_API_KEY and try again.",
          );
        }

        const provider = resolveDefault("generation");
        const result = await withProviderCall(
          ctx,
          {
            capability: "GENERATION",
            provider: provider.provider,
            model: provider.model,
            operationId,
          },
          () =>
            provider.generateJson(buildPromptGenerationRequest(context.input)),
        );

        return {
          prompts: result.content.prompts,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        };
      },
    );

    const createdCount = await step.run("persist-prompts", async () => {
      const count = await bulkCreateGeneratedPrompts(ctx, {
        brandId,
        marketId: context.marketId,
        prompts: generated.prompts,
      });

      await recordUsage(ctx, {
        meter: USAGE_METERS.PROMPT_GENERATION_INPUT_TOKENS,
        quantity: generated.inputTokens,
        operationId,
        idempotencyKey: `${operationId}:input-tokens`,
      });
      await recordUsage(ctx, {
        meter: USAGE_METERS.PROMPT_GENERATION_OUTPUT_TOKENS,
        quantity: generated.outputTokens,
        operationId,
        idempotencyKey: `${operationId}:output-tokens`,
      });

      return count;
    });

    await step.run("complete-operation", () =>
      completeOperation(ctx, operationId, {
        metadata: { brandId, createdCount },
      }),
    );

    log.info({ brandId, createdCount }, "prompt generation completed");

    return { brandId, createdCount };
  },
);
