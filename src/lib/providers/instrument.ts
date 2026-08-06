import type { ProviderCapability } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";
import { calculateCost } from "@/lib/llm/pricing";
import type { LlmResult } from "@/lib/llm/types";

type ProviderCallSpec = {
  capability: ProviderCapability;
  provider: string;
  model: string;
  operationId?: string;
};

/**
 * Wraps a single external provider call and records a ProviderCall row for
 * it — on success or failure, with timing and, where a rate is known, cost.
 * This is the ONLY place ProviderCall rows are written; adapters (GlmProvider
 * and every future SERP/crawl/publish adapter) must never write it
 * themselves, or cost and margin reporting becomes a union query across
 * inconsistent bookkeeping by the time Phase 7 needs it. See
 * docs/adr/0003-provider-abstraction.md.
 *
 * Also fills in the timing/cost fields on the returned LlmResult, since this
 * is the one place that measures wall-clock duration and holds the pricing
 * table — adapters leave those fields null.
 */
export async function withProviderCall<T>(
  ctx: WorkspaceContext,
  spec: ProviderCallSpec,
  fn: () => Promise<LlmResult<T>>,
): Promise<LlmResult<T>> {
  const requestedAt = new Date();

  try {
    const result = await fn();
    const completedAt = new Date();
    const cost = calculateCost(
      spec.provider,
      spec.model,
      result.usage,
      requestedAt,
    );

    await scopedDb(ctx).providerCall.create({
      data: {
        workspaceId: ctx.workspaceId,
        operationId: spec.operationId,
        capability: spec.capability,
        provider: spec.provider,
        providerVersion: result.providerVersion,
        requestId: result.requestId,
        status: "COMPLETED",
        requestedAt,
        completedAt,
        costUnits: cost?.costUnits,
        currency: cost?.currency,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    });

    return {
      ...result,
      requestedAt: requestedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      costUnits: cost?.costUnits ?? null,
      currency: cost?.currency ?? null,
    };
  } catch (error) {
    const completedAt = new Date();

    await scopedDb(ctx).providerCall.create({
      data: {
        workspaceId: ctx.workspaceId,
        operationId: spec.operationId,
        capability: spec.capability,
        provider: spec.provider,
        status: "FAILED",
        requestedAt,
        completedAt,
        errorCode: "PROVIDER_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}
