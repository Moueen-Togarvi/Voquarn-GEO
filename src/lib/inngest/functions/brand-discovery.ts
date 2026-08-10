import { NonRetriableError } from "inngest";

import type { WorkspaceContext } from "@/lib/auth/context";
import { createBrand, setBrandMarket, updateBrand } from "@/lib/brands/service";
import {
  cacheRobots,
  getCachedRobots,
  persistAiCrawlerAccess,
} from "@/lib/crawl/service";
import { fetchPageForCrawl } from "@/lib/crawl/fetcher";
import { auditAiCrawlerAccess } from "@/lib/geo/ai-crawler-audit";
import {
  buildDiscoveryRequest,
  fixtureProfile,
  parseDiscoveredProfile,
  shouldUseDiscoveryFixture,
} from "@/lib/discovery/brand-profile";
import {
  assertPublicWebsiteUrl,
  UnsafeWebsiteError,
} from "@/lib/discovery/website";
import { readPublicWebsiteProfile } from "@/lib/discovery/site-profile";
import { scopedDb } from "@/lib/db/scoped";
import { inngest } from "@/lib/inngest/client";
import {
  brandDiscoveryRequested,
  competitorExpansionRequested,
  promptsGenerationRequested,
} from "@/lib/inngest/events";
import { resolveDefault } from "@/lib/llm/registry";
import type { LlmSource, LlmUsage } from "@/lib/llm/types";
import { childLogger } from "@/lib/observability/logger";
import {
  completeOperation,
  createOperation,
  failOperation,
  setOperationBrand,
  startOperation,
} from "@/lib/operations/service";
import { withProviderCall } from "@/lib/providers/instrument";
import { recordUsage, USAGE_METERS } from "@/lib/usage/ledger";
import type { BrandDiscoveryInput } from "@/lib/validation/brand";
import { findOrCreateMarket } from "@/lib/markets/service";

type DiscoveryResult = {
  profile: ReturnType<typeof parseDiscoveredProfile>;
  sources: LlmSource[];
  usage: LlmUsage;
  providerCallId: string | null;
};

/**
 * The reference pattern every later long-running feature copies: 202 from
 * the route, an Operation the client polls, and a durable Inngest function
 * doing the actual work in idempotent steps. See
 * docs/adr/0006-workflows-and-operations.md.
 *
 * Handles both first-time onboarding (event.data.brandId is null — the row
 * doesn't exist yet) and re-analysis of an existing brand (brandId is set)
 * under one function, since the work is identical apart from create vs
 * update at the persistence step.
 */
export const brandDiscovery = inngest.createFunction(
  {
    id: "brand-discovery",
    triggers: [{ event: brandDiscoveryRequested }],
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
        errorCode: "DISCOVERY_FAILED",
        errorMessage: error.message,
      });
    },
  },
  async ({ event, step }) => {
    const { workspaceId, operationId, brandId, name, websiteUrl } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };
    const input: BrandDiscoveryInput = { name, websiteUrl };
    const log = childLogger({ operationId, workspaceId, fn: "brandDiscovery" });

    await step.run("start-operation", () => startOperation(ctx, operationId));

    // Re-validated on the worker even though the route handler already
    // checked once — that check ran on a different process, possibly much
    // earlier, and must not be trusted blindly here.
    await step.run("validate-url", async () => {
      try {
        await assertPublicWebsiteUrl(websiteUrl);
      } catch (error) {
        if (error instanceof UnsafeWebsiteError) {
          throw new NonRetriableError(error.message, { cause: error });
        }
        throw error;
      }
    });

    const snapshot = await step.run("scrape-website-profile", () =>
      readPublicWebsiteProfile(websiteUrl),
    );

    const discovery = await step.run(
      "llm-research",
      async (): Promise<DiscoveryResult> => {
        if (shouldUseDiscoveryFixture()) {
          return {
            profile: fixtureProfile(input),
            sources: [],
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            providerCallId: null,
          };
        }

        if (!process.env.OPENAI_API_KEY) {
          throw new NonRetriableError(
            "Automatic brand research is not configured. Add OPENAI_API_KEY and try again.",
          );
        }

        const provider = resolveDefault("discovery");
        const result = await withProviderCall(
          ctx,
          {
            capability: "GENERATION",
            provider: provider.provider,
            model: provider.model,
            operationId,
          },
          () => provider.generateJson(buildDiscoveryRequest(input, snapshot)),
        );

        // withProviderCall already wrote the ProviderCall row; find its id so
        // sources can anchor to it (Source has no PromptRun here to attach to
        // — see the Source model comment in schema.prisma).
        const providerCall = await scopedDb(ctx).providerCall.findFirst({
          where: { requestId: result.requestId, provider: provider.provider },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        return {
          profile: {
            ...parseDiscoveredProfile(input, result.content),
            discoveryPageCount: snapshot.pages.length,
          },
          sources: result.sources,
          usage: result.usage,
          providerCallId: providerCall?.id ?? null,
        };
      },
    );

    const brand = await step.run("persist-brand", async () => {
      const saved = brandId
        ? await updateBrand(ctx, brandId, discovery.profile)
        : await createBrand(ctx, discovery.profile);

      if (discovery.sources.length > 0 && discovery.providerCallId) {
        await scopedDb(ctx).source.createMany({
          data: discovery.sources.map((source) => ({
            workspaceId: ctx.workspaceId,
            providerCallId: discovery.providerCallId as string,
            url: source.url,
            domain: new URL(source.url).hostname.toLowerCase(),
            title: source.title,
            snippet: source.snippet,
            providerRef: source.providerRef,
          })),
          skipDuplicates: true,
        });
      }

      await recordUsage(ctx, {
        meter: USAGE_METERS.DISCOVERY_INPUT_TOKENS,
        quantity: discovery.usage.inputTokens,
        operationId,
        idempotencyKey: `${operationId}:input-tokens`,
      });
      await recordUsage(ctx, {
        meter: USAGE_METERS.DISCOVERY_OUTPUT_TOKENS,
        quantity: discovery.usage.outputTokens,
        operationId,
        idempotencyKey: `${operationId}:output-tokens`,
      });

      return saved;
    });

    if (!brandId) {
      await step.run("attach-operation-brand", () =>
        setOperationBrand(ctx, operationId, brand.id),
      );
    }

    // New projects receive a usable default market before Step 2 so prompt
    // generation can happen while the user reviews the AI-discovered profile.
    // Re-analysis keeps the project's existing market unchanged.
    if (!brandId) {
      await step.run("configure-onboarding-market", async () => {
        const market = await findOrCreateMarket(ctx, {
          country: "US",
          region: null,
          city: null,
          language: "en",
          device: "DESKTOP",
          timezone: "UTC",
        });
        await setBrandMarket(ctx, brand.id, {
          defaultMarketId: market.id,
          timezone: market.timezone,
        });
      });
    }

    // Best-effort GEO finding: is this domain blocking the crawlers that
    // actually feed AI answers? Reuses the exact fetch-cache-audit-persist
    // recipe crawl.ts uses for a full site crawl, but standalone — a single
    // robots.txt fetch, never gating discovery's own completion. Runs for
    // both first-time onboarding and re-analysis since robots.txt can change;
    // the 24h robots cache keeps repeats near-free. Any failure here (fetch
    // error, timeout, malformed body) is swallowed — this is an enrichment,
    // never a reason to fail brand discovery itself.
    await step.run("audit-ai-crawlers", async () => {
      try {
        const host = brand.domain;
        let robotsBody = await getCachedRobots(host);
        if (robotsBody === null) {
          const outcome = await fetchPageForCrawl(
            `https://${host}/robots.txt`,
            {
              allowedContentTypes: null,
            },
          );
          if (outcome.kind === "ok") {
            robotsBody = outcome.result.html;
            await cacheRobots(host, robotsBody);
          }
        }
        await persistAiCrawlerAccess(host, auditAiCrawlerAccess(robotsBody));
      } catch (error) {
        log.warn(
          { err: error instanceof Error ? error.message : String(error) },
          "ai crawler audit failed, continuing",
        );
      }
    });

    // Fires the larger ranked Top-30 competitor set as a separate,
    // background pipeline rather than folding it into this function — see
    // src/lib/inngest/functions/competitor-expansion.ts. Wrapped in step.run
    // for the same memoization guarantee every other step here relies on:
    // without it, a retry of a later step (there isn't one today, but the
    // next one added) could re-send this event and start a second run.
    await step.run("trigger-competitor-expansion", async () => {
      const operation = await createOperation(ctx, {
        kind: "COMPETITOR_EXPANSION",
        brandId: brand.id,
        progressTotal: 1,
      });
      await inngest.send(
        competitorExpansionRequested.create({
          workspaceId,
          brandId: brand.id,
          operationId: operation.id,
        }),
      );
    });

    if (!brandId) {
      await step.run("trigger-prompt-generation", async () => {
        const operation = await createOperation(ctx, {
          kind: "PROMPT_GENERATION",
          brandId: brand.id,
          progressTotal: 3,
        });
        await inngest.send(
          promptsGenerationRequested.create({
            workspaceId,
            brandId: brand.id,
            operationId: operation.id,
          }),
        );
      });
    }

    // Complete only after both Step-2 background operations exist. The client
    // navigates as soon as this operation settles, so completing earlier would
    // race the review page and briefly show neither prompts nor progress.
    await step.run("complete-operation", () =>
      completeOperation(ctx, operationId, {
        metadata: {
          brandId: brand.id,
          sourceCount: discovery.sources.length,
          pagesAnalyzed: snapshot.pages.length,
        },
      }),
    );

    log.info({ brandId: brand.id }, "brand discovery completed");

    return { brandId: brand.id };
  },
);
