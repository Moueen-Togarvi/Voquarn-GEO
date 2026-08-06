import { NonRetriableError } from "inngest";

import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";
import {
  computeAndStoreThreatScore,
  findRecentSnapshot,
  getOrCreateThreatScoreDefinitionId,
  listTrackedKeywords,
  persistSerpSnapshot,
  recordCompetitorObservations,
} from "@/lib/hunt/service";
import { chunk } from "@/lib/inngest/chunk";
import { inngest } from "@/lib/inngest/client";
import {
  huntSerpKeywordRequested,
  huntSerpRequested,
  huntThreatRecomputeRequested,
} from "@/lib/inngest/events";
import { childLogger } from "@/lib/observability/logger";
import {
  advanceOperation,
  completeOperation,
  failOperation,
  startOperation,
} from "@/lib/operations/service";
import { DataForSeoClient } from "@/lib/providers/dataforseo/client";
import {
  fixtureSerpResponse,
  shouldUseHuntFixture,
} from "@/lib/providers/dataforseo/fixture";
import {
  mapSerpResponse,
  type MappedSerpResult,
} from "@/lib/providers/dataforseo/mapper";
import { buildSerpRequest } from "@/lib/providers/dataforseo/serp";
import { withGenericProviderCall } from "@/lib/providers/instrument";
import { writeSnapshot } from "@/lib/storage/blob";

/**
 * Fetches (or reuses a cached) SERP for exactly one (keyword, market,
 * device). Deliberately brand-agnostic — a Keyword is market-scoped, not
 * brand-scoped (see the Keyword model comment in schema.prisma), so this
 * function is safe to share across every brand that happens to track the
 * same keyword in the same market. huntSerpBatch (below), which does know
 * the brand, derives CompetitorObservation rows from whatever this returns.
 */
export const huntSerpFetch = inngest.createFunction(
  {
    id: "hunt-serp-fetch",
    triggers: [{ event: huntSerpKeywordRequested }],
    concurrency: { key: "event.data.workspaceId", limit: 4 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { workspaceId, keywordId, marketId, device } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };

    const cached = await step.run("check-cache", () =>
      findRecentSnapshot(ctx, { keywordId, marketId, device }),
    );
    if (cached) {
      const results = await step.run("load-cached-results", async () => {
        const rows = await scopedDb(ctx).serpResult.findMany({
          where: { snapshotId: cached.id },
        });
        return rows.map((row): MappedSerpResult => ({
          position: row.position,
          url: row.url,
          domain: row.domain,
          registrableDomain: row.registrableDomain,
          title: row.title,
          snippet: row.snippet,
          type: row.type,
        }));
      });
      return { snapshotId: cached.id, results };
    }

    const context = await step.run("load-context", async () => {
      const keyword = await scopedDb(ctx).keyword.findFirstOrThrow({
        where: { id: keywordId },
      });
      const market = await scopedDb(ctx).market.findFirstOrThrow({
        where: { id: marketId },
      });
      return {
        keywordText: keyword.text,
        country: market.country,
        language: market.language,
      };
    });

    const outcome = await step.run("fetch-and-persist", async () => {
      let providerCallId: string | null = null;
      let rawSnapshotId: string | null = null;
      let mapped: ReturnType<typeof mapSerpResponse>;

      if (shouldUseHuntFixture()) {
        mapped = mapSerpResponse(fixtureSerpResponse(context.keywordText));
      } else {
        if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
          throw new NonRetriableError(
            "SERP hunting is not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD and try again.",
          );
        }

        const client = new DataForSeoClient();
        const request = buildSerpRequest({
          keyword: context.keywordText,
          country: context.country,
          language: context.language,
          device,
        });

        const providerOutcome = await withGenericProviderCall(
          ctx,
          { capability: "SERP", provider: "dataforseo" },
          () => client.fetchOrganicSerp(request),
        );
        providerCallId = providerOutcome.providerCallId;

        const raw = await writeSnapshot(ctx, {
          bytes: Buffer.from(JSON.stringify(providerOutcome.result)),
          mimeType: "application/json",
        });
        rawSnapshotId = raw.id;

        mapped = mapSerpResponse(providerOutcome.result);
      }

      const snapshot = await persistSerpSnapshot(ctx, {
        keywordId,
        marketId,
        device,
        providerCallId,
        rawSnapshotId,
        results: mapped.results,
        resultCount: mapped.resultCount,
      });

      return { snapshotId: snapshot.id, results: mapped.results };
    });

    return outcome;
  },
);

const FANOUT_CHUNK_SIZE = 8;

/**
 * Orchestrates one brand's hunt across every ACTIVE keyword it tracks in
 * one market: fans out to huntSerpFetch per keyword (bounded, parallel,
 * independently cached and retried), derives CompetitorObservation
 * evidence from each result, then requests a threat-score recompute for
 * the whole brand once hunting settles.
 */
export const huntSerpBatch = inngest.createFunction(
  {
    id: "hunt-serp-batch",
    triggers: [{ event: huntSerpRequested }],
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
        errorCode: "HUNT_FAILED",
        errorMessage: error.message,
      });
    },
  },
  async ({ event, step }) => {
    const { workspaceId, brandId, marketId, operationId } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };
    const log = childLogger({ brandId, workspaceId, fn: "huntSerpBatch" });

    await step.run("start-operation", () => startOperation(ctx, operationId));

    const market = await step.run("load-market", () =>
      scopedDb(ctx).market.findFirstOrThrow({ where: { id: marketId } }),
    );

    const allKeywords = await step.run("load-tracked-keywords", () =>
      listTrackedKeywords(ctx, brandId),
    );
    const keywords = allKeywords.filter(
      (keyword) => keyword.marketId === marketId,
    );

    let processed = 0;
    for (const group of chunk(keywords, FANOUT_CHUNK_SIZE)) {
      const settled = await Promise.allSettled(
        group.map((keyword) =>
          step.invoke(`fetch-${keyword.keywordId}`, {
            function: huntSerpFetch,
            data: {
              workspaceId,
              keywordId: keyword.keywordId,
              marketId,
              device: market.device,
            },
          }),
        ),
      );

      for (let index = 0; index < settled.length; index += 1) {
        const outcome = settled[index];
        const keyword = group[index];
        if (outcome?.status === "fulfilled" && keyword) {
          await step.run(`record-observations-${keyword.keywordId}`, () =>
            recordCompetitorObservations(ctx, {
              brandId,
              keywordId: keyword.keywordId,
              snapshotId: outcome.value.snapshotId,
              results: outcome.value.results,
            }),
          );
        }
        processed += 1;
      }

      await step.run(`advance-progress-${processed}`, () =>
        advanceOperation(ctx, operationId, {
          progressCurrent: processed,
          progressTotal: keywords.length,
        }),
      );
    }

    const scoreDefinitionId = await step.run("resolve-score-definition", () =>
      getOrCreateThreatScoreDefinitionId(),
    );

    await step.sendEvent(
      "request-threat-recompute",
      huntThreatRecomputeRequested.create({
        workspaceId,
        brandId,
        scoreDefinitionId,
      }),
    );

    await step.run("complete-operation", () =>
      completeOperation(ctx, operationId, {
        metadata: { brandId, marketId, keywordsHunted: keywords.length },
      }),
    );

    log.info({ keywordsHunted: keywords.length }, "hunt SERP batch finished");

    return { brandId, keywordsHunted: keywords.length };
  },
);

/**
 * Recomputes and stores a new ThreatScore for every accepted/pinned
 * competitor of a brand. Each competitor's score is its own step.run so a
 * retried run doesn't create duplicate ThreatScore rows for competitors
 * already scored before a mid-loop failure — ThreatScore is an append-only
 * time series (see the model comment in schema.prisma), not something a
 * retry can safely upsert.
 */
export const threatScoreCompute = inngest.createFunction(
  {
    id: "threat-score-compute",
    triggers: [{ event: huntThreatRecomputeRequested }],
    concurrency: { key: "event.data.workspaceId", limit: 2 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { workspaceId, brandId, scoreDefinitionId } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };

    const competitors = await step.run("load-competitors", () =>
      scopedDb(ctx).competitor.findMany({
        where: { brandId, status: { in: ["ACCEPTED", "PINNED"] } },
        select: { id: true },
      }),
    );

    for (const competitor of competitors) {
      await step.run(`score-${competitor.id}`, () =>
        computeAndStoreThreatScore(ctx, {
          brandId,
          competitorId: competitor.id,
          scoreDefinitionId,
        }),
      );
    }

    return { brandId, scoredCount: competitors.length };
  },
);
