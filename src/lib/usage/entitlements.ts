import { AppError } from "@/lib/api/errors";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

export type EntitlementLimits = {
  brands: number;
  /** Total PromptRun rows (activePrompts × repetitions) a single benchmark batch may create — bounds provider spend per request before Stripe exists to bill for it. */
  benchmarkBatchRuns: number;
  /** Total ContentItem rows a workspace may have — Phase 6 drafts are the most expensive per-unit LLM spend in the product (research + brief + N sections + claims + quality judge, all structured-output calls). */
  contentDrafts: number;
};

/**
 * Applies to every workspace that has no Entitlement row of its own — which
 * is all of them until Phase 8 wires up Stripe plans. A workspace can be
 * given a higher (or lower) ceiling by writing an Entitlement row; absence
 * of a row means "use these."
 */
const DEFAULT_LIMITS: EntitlementLimits = {
  brands: 3,
  benchmarkBatchRuns: 150,
  contentDrafts: 25,
};

export async function getEntitlementLimits(
  ctx: WorkspaceContext,
): Promise<EntitlementLimits> {
  const override = await scopedDb(ctx).entitlement.findUnique({
    where: { workspaceId: ctx.workspaceId },
  });

  if (!override) {
    return DEFAULT_LIMITS;
  }

  return {
    ...DEFAULT_LIMITS,
    ...(override.limits as Partial<EntitlementLimits>),
  };
}

/** Throws 402 QUOTA_EXCEEDED when `currentUsage` has already reached the limit. */
export async function assertWithinLimit(
  ctx: WorkspaceContext,
  key: keyof EntitlementLimits,
  currentUsage: number,
): Promise<void> {
  const limits = await getEntitlementLimits(ctx);
  const limit = limits[key];

  if (currentUsage >= limit) {
    throw new AppError(
      402,
      "QUOTA_EXCEEDED",
      `This workspace has reached its ${key} limit (${limit}). Contact support to raise it.`,
    );
  }
}
