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
 * This is the ONLY place ProviderCall rows are written; adapters
 * (OpenAiProvider and every future SERP/crawl/publish adapter) never write it
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

export type GenericProviderCallSpec = {
  capability: ProviderCapability;
  provider: string;
  operationId?: string;
};

export type GenericProviderCallOutcome<T> = {
  result: T;
  providerCallId: string;
};

/**
 * A non-LLM sibling to withProviderCall() above — that function's signature
 * is intentionally LLM-specific (it reads LlmResult<T>'s usage/cost/
 * requestId fields to fill in the row). This one makes no assumption about
 * the wrapped call's return shape beyond "it's the raw provider response,"
 * which is what Scrape.do's SERP client needs. Both still funnel every
 * ProviderCall write through this one file, which is the part of
 * docs/adr/0003-provider-abstraction.md that actually matters; unifying the
 * two into one generic wrapper is a reasonable cleanup once a third
 * provider shape (crawl, publish) shows what the common surface should be.
 */
export async function withGenericProviderCall<T>(
  ctx: WorkspaceContext,
  spec: GenericProviderCallSpec,
  fn: () => Promise<T>,
): Promise<GenericProviderCallOutcome<T>> {
  const requestedAt = new Date();

  try {
    const result = await fn();
    const completedAt = new Date();

    const providerCall = await scopedDb(ctx).providerCall.create({
      data: {
        workspaceId: ctx.workspaceId,
        operationId: spec.operationId,
        capability: spec.capability,
        provider: spec.provider,
        status: "COMPLETED",
        requestedAt,
        completedAt,
      },
    });

    return { result, providerCallId: providerCall.id };
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
