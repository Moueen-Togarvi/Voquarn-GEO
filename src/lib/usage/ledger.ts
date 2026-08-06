import type { Prisma } from "@/generated/prisma/client";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";

/**
 * Known meter names for the phases shipped so far. `UsageEvent.meter` is a
 * plain string column, not an enum, specifically so later phases can add
 * meters (SERP requests, crawl pages, embedding tokens — see
 * docs/cost-model.md) without a migration. Add to this object as new meters
 * come online; do not invent ad hoc strings at call sites.
 */
export const USAGE_METERS = {
  DISCOVERY_INPUT_TOKENS: "llm.discovery.input_tokens",
  DISCOVERY_OUTPUT_TOKENS: "llm.discovery.output_tokens",
  DISCOVERY_REQUESTS: "llm.discovery.requests",
  PROMPT_GENERATION_INPUT_TOKENS: "llm.prompt_generation.input_tokens",
  PROMPT_GENERATION_OUTPUT_TOKENS: "llm.prompt_generation.output_tokens",
  BENCHMARK_INPUT_TOKENS: "llm.benchmark.input_tokens",
  BENCHMARK_OUTPUT_TOKENS: "llm.benchmark.output_tokens",
  BENCHMARK_RUNS: "llm.benchmark.runs",
} as const;

export type UsageMeter =
  (typeof USAGE_METERS)[keyof typeof USAGE_METERS] | (string & {});

/**
 * Appends one usage event. This is the source of truth for entitlement
 * enforcement — Stripe (Phase 8) only ever reads from it to post invoicing
 * meter events, never the other way around.
 *
 * Idempotent: recording the same `idempotencyKey` twice (an Inngest step
 * retry after the row already committed) is a silent no-op, not an error.
 */
export async function recordUsage(
  ctx: WorkspaceContext,
  input: {
    meter: UsageMeter;
    quantity: number;
    operationId?: string;
    idempotencyKey: string;
  },
): Promise<void> {
  try {
    await scopedDb(ctx).usageEvent.create({
      data: {
        workspaceId: ctx.workspaceId,
        meter: input.meter,
        quantity: input.quantity,
        operationId: input.operationId,
        idempotencyKey: input.idempotencyKey,
      } satisfies Prisma.UsageEventUncheckedCreateInput,
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return;
    }
    throw error;
  }
}
