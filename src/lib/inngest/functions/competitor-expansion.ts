import type { WorkspaceContext } from "@/lib/auth/context";
import { upsertExpandedCompetitors } from "@/lib/competitors/service";
import type { CompetitorTier } from "@/lib/discovery/competitor-expansion";
import {
  buildCompetitorTierRequest,
  fixtureCompetitorTier,
  shouldUseCompetitorExpansionFixture,
  type CompetitorExpansionInput,
} from "@/lib/discovery/competitor-expansion";
import { scopedDb } from "@/lib/db/scoped";
import { inngest } from "@/lib/inngest/client";
import { competitorExpansionRequested } from "@/lib/inngest/events";
import { resolveDefault } from "@/lib/llm/registry";
import { childLogger } from "@/lib/observability/logger";
import {
  advanceOperation,
  completeOperation,
  failOperation,
  partialOperation,
  startOperation,
} from "@/lib/operations/service";
import { withProviderCall } from "@/lib/providers/instrument";

const TIERS: CompetitorTier[] = ["TOP"];

type TierOutcome = { processed: number; failed: boolean };

/**
 * Builds one ranked list of direct competitors. The onboarding product keeps
 * a hard limit of 30; adjacent and tangential tiers are intentionally omitted.
 */
export const competitorExpansion = inngest.createFunction(
  {
    id: "competitor-expansion",
    triggers: [{ event: competitorExpansionRequested }],
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
        errorCode: "COMPETITOR_EXPANSION_FAILED",
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
      fn: "competitorExpansion",
    });

    await step.run("start-operation", () => startOperation(ctx, operationId));

    const context = await step.run(
      "load-context",
      async (): Promise<CompetitorExpansionInput> => {
        const brand = await scopedDb(ctx).brand.findFirstOrThrow({
          where: { id: brandId },
          include: { competitors: { select: { domain: true } } },
        });

        return {
          brand: {
            name: brand.name,
            websiteUrl: brand.websiteUrl,
            description: brand.description,
            category: brand.category,
            services: brand.services,
            audiences: brand.audiences,
            painPoints: brand.painPoints,
            differentiators: brand.differentiators,
          },
          knownDomains: brand.competitors.map((c) => c.domain),
        };
      },
    );

    const tierResults: Record<CompetitorTier, TierOutcome> = {
      TOP: { processed: 0, failed: false },
      MIDDLE: { processed: 0, failed: false },
      BOTTOM: { processed: 0, failed: false },
    };

    for (let i = 0; i < TIERS.length; i += 1) {
      const tier = TIERS[i];
      const stepSuffix = tier.toLowerCase();

      try {
        const result = await step.run(
          `llm-discover-${stepSuffix}`,
          async () => {
            if (shouldUseCompetitorExpansionFixture()) {
              return fixtureCompetitorTier(context, tier);
            }

            if (!process.env.OPENAI_API_KEY) {
              throw new Error(
                "Automatic competitor research is not configured. Add OPENAI_API_KEY and try again.",
              );
            }

            const provider = resolveDefault("discovery");
            const providerResult = await withProviderCall(
              ctx,
              {
                capability: "GENERATION",
                provider: provider.provider,
                model: provider.model,
                operationId,
              },
              () =>
                provider.generateJson(
                  buildCompetitorTierRequest(context, tier),
                ),
            );

            return providerResult.content;
          },
        );

        const written = await step.run(`persist-${stepSuffix}`, () =>
          upsertExpandedCompetitors(ctx, brandId, tier, result.competitors),
        );

        tierResults[tier] = {
          processed: written.processedCount,
          failed: false,
        };
      } catch (error) {
        log.error(
          { tier, error: error instanceof Error ? error.message : error },
          "competitor expansion tier failed",
        );
        tierResults[tier] = { processed: 0, failed: true };
      }

      await step.run(`advance-${stepSuffix}`, () =>
        advanceOperation(ctx, operationId, {
          progressCurrent: i + 1,
          progressTotal: TIERS.length,
        }),
      );
    }

    const anyFailed = Object.values(tierResults).some((r) => r.failed);
    const metadata = { tierResults };

    await step.run("complete-operation", () =>
      anyFailed
        ? partialOperation(ctx, operationId, {
            errorCode: "COMPETITOR_EXPANSION_PARTIAL",
            errorMessage: "One or more competitor tiers could not be fetched.",
            metadata,
          })
        : completeOperation(ctx, operationId, { metadata }),
    );

    log.info({ brandId, tierResults }, "competitor expansion completed");

    return { brandId, tierResults };
  },
);
