import { NonRetriableError } from "inngest";

import type { WorkspaceContext } from "@/lib/auth/context";
import { createBrand, updateBrand } from "@/lib/brands/service";
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
import { brandDiscoveryRequested } from "@/lib/inngest/events";
import { resolveDefault } from "@/lib/llm/registry";
import type { LlmSource, LlmUsage } from "@/lib/llm/types";
import { childLogger } from "@/lib/observability/logger";
import {
  completeOperation,
  failOperation,
  setOperationBrand,
  startOperation,
} from "@/lib/operations/service";
import { withProviderCall } from "@/lib/providers/instrument";
import { recordUsage, USAGE_METERS } from "@/lib/usage/ledger";
import type { BrandDiscoveryInput } from "@/lib/validation/brand";

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

    await step.run("complete-operation", async () => {
      if (!brandId) {
        await setOperationBrand(ctx, operationId, brand.id);
      }
      await completeOperation(ctx, operationId, {
        metadata: {
          brandId: brand.id,
          sourceCount: discovery.sources.length,
          pagesAnalyzed: snapshot.pages.length,
        },
      });
    });

    log.info({ brandId: brand.id }, "brand discovery completed");

    return { brandId: brand.id };
  },
);
