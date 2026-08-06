import type { WorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { getLatestCrawlRun } from "@/lib/crawl/service";
import { GlmEmbeddingProvider } from "@/lib/embeddings/provider";
import {
  ensurePageEmbeddings,
  ensureTopicEmbeddings,
} from "@/lib/embeddings/service";
import { scopedDb } from "@/lib/db/scoped";
import {
  runTopicDetectors,
  detectCitationGaps,
} from "@/lib/opportunity/detectors";
import { explainOpportunity } from "@/lib/opportunity/explain";
import {
  buildTopicCoverages,
  createOpportunityIfNew,
  getBenchmarkCitationShares,
  getOrCreateOpportunityScoreDefinitionId,
  upgradeOpportunityText,
  type CoverageCompetitor,
} from "@/lib/opportunity/service";
import type { DetectedGap } from "@/lib/opportunity/types";
import { inngest } from "@/lib/inngest/client";
import { opportunityDetectRequested } from "@/lib/inngest/events";
import { childLogger } from "@/lib/observability/logger";
import {
  advanceOperation,
  completeOperation,
  failOperation,
  startOperation,
} from "@/lib/operations/service";

/** Bounds LLM spend on explain() — the highest-scored newly-created opportunities get a narrated upgrade; the rest keep their deterministic (still real, still useful) text. */
const MAX_EXPLAIN_PER_RUN = 10;

/**
 * One brand's full gap-detection pass: builds topic-vs-competitor coverage
 * from crawled pages (Phase 4) plus AI-benchmark citation share (Phase 2),
 * runs every detector, and persists whatever is genuinely new — see
 * createOpportunityIfNew's comment on why a rerun never touches an existing
 * row. No child fan-out (unlike hunt/crawl): the per-unit work here is
 * local computation and a handful of batched embedding calls, not
 * independently-rate-limited external requests per topic.
 */
export const opportunityDetect = inngest.createFunction(
  {
    id: "opportunity-detect",
    triggers: [{ event: opportunityDetectRequested }],
    concurrency: { key: "event.data.workspaceId", limit: 2 },
    retries: 2,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data;
      const ctx: WorkspaceContext = {
        workspaceId: original.workspaceId,
        userId: null,
        role: "OWNER",
      };
      await failOperation(ctx, original.operationId, {
        errorCode: "OPPORTUNITY_DETECT_FAILED",
        errorMessage: error.message,
      });
    },
  },
  async ({ event, step }) => {
    const { workspaceId, brandId, operationId } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };
    const log = childLogger({ brandId, workspaceId, fn: "opportunityDetect" });

    await step.run("start-operation", () => startOperation(ctx, operationId));

    const context = await step.run("load-context", async () => {
      const brand = await getBrand(ctx, brandId);
      if (!brand) throw new Error(`Brand ${brandId} not found`);

      const competitors = await scopedDb(ctx).competitor.findMany({
        where: { brandId, status: { in: ["ACCEPTED", "PINNED"] } },
      });

      const ownCrawlRun = await getLatestCrawlRun(ctx, { brandId });
      const coverageCompetitors: CoverageCompetitor[] = await Promise.all(
        competitors.map(async (competitor) => {
          const run = await getLatestCrawlRun(ctx, {
            competitorId: competitor.id,
          });
          return {
            competitorId: competitor.id,
            competitorName: competitor.name,
            crawlRunId: run?.id ?? null,
          };
        }),
      );

      return {
        brandName: brand.name,
        ownCrawlRunId: ownCrawlRun?.id ?? null,
        competitors: coverageCompetitors,
      };
    });

    if (process.env.ZAI_API_KEY) {
      await step.run("ensure-embeddings", async () => {
        const provider = new GlmEmbeddingProvider();
        try {
          await ensureTopicEmbeddings(ctx, {
            brandId,
            provider,
            operationId,
          });
        } catch (error) {
          log.warn(
            { err: error instanceof Error ? error.message : String(error) },
            "topic embedding failed, continuing with whatever exists",
          );
        }

        const crawlRunIds = [
          context.ownCrawlRunId,
          ...context.competitors.map((competitor) => competitor.crawlRunId),
        ].filter((id): id is string => id !== null);

        for (const crawlRunId of crawlRunIds) {
          try {
            await ensurePageEmbeddings(ctx, {
              crawlRunId,
              provider,
              operationId,
            });
          } catch (error) {
            log.warn(
              {
                crawlRunId,
                err: error instanceof Error ? error.message : String(error),
              },
              "page embedding failed for one crawl run, continuing",
            );
          }
        }
      });
    }

    const gaps = await step.run("detect-gaps", async () => {
      const coverages = await buildTopicCoverages(ctx, {
        brandId,
        ownCrawlRunId: context.ownCrawlRunId,
        competitors: context.competitors,
      });

      const topicGaps = coverages.flatMap((coverage) =>
        runTopicDetectors(coverage),
      );

      const citationInput = await getBenchmarkCitationShares(ctx, brandId);
      const citationGaps = detectCitationGaps(citationInput);

      return [...topicGaps, ...citationGaps];
    });

    const scoreDefinitionId = await step.run("resolve-score-definition", () =>
      getOrCreateOpportunityScoreDefinitionId(),
    );

    const created = await step.run("persist-opportunities", async () => {
      const persisted: { id: string; score: number; gap: DetectedGap }[] = [];
      for (const gap of gaps as DetectedGap[]) {
        const opportunity = await createOpportunityIfNew(ctx, {
          brandId,
          gap,
          scoreDefinitionId,
        });
        if (opportunity) {
          persisted.push({ id: opportunity.id, score: opportunity.score, gap });
        }
      }
      return persisted;
    });

    await advanceOperation(ctx, operationId, {
      progressTotal: gaps.length,
      progressCurrent: gaps.length,
    });

    if (process.env.ZAI_API_KEY && created.length > 0) {
      await step.run("explain-top-opportunities", async () => {
        const top = [...created]
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_EXPLAIN_PER_RUN);

        for (const opportunity of top) {
          const explained = await explainOpportunity(ctx, {
            gap: opportunity.gap,
            brandName: context.brandName,
            operationId,
          });
          if (explained) {
            await upgradeOpportunityText(ctx, opportunity.id, explained);
          }
        }
      });
    }

    await completeOperation(ctx, operationId, {
      metadata: { detected: gaps.length, created: created.length },
    });

    return { detected: gaps.length, created: created.length };
  },
);
