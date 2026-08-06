import { createHash } from "node:crypto";

import { NonRetriableError } from "inngest";

import type { RenderMode } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import {
  cacheRobots,
  computeContentHash,
  finalizeCrawlRun,
  getCachedRobots,
  incrementCrawlRunCounter,
  persistAiCrawlerAccess,
  persistPageObservation,
  persistPageSnapshot,
  persistPerformanceObservation,
  persistSchemaObservations,
  startCrawlRun,
} from "@/lib/crawl/service";
import { extractPage } from "@/lib/crawl/extract";
import { fetchPageForCrawl } from "@/lib/crawl/fetcher";
import { resolveFreshness } from "@/lib/crawl/freshness";
import { classifyIntent } from "@/lib/crawl/intent";
import { isCrawlAllowed, needsBrowserRender } from "@/lib/crawl/policy";
import { parseRobotsTxt } from "@/lib/crawl/robots";
import { validateJsonLdBlocks } from "@/lib/crawl/schema-validate";
import { parseSitemap } from "@/lib/crawl/sitemap";
import { scopedDb } from "@/lib/db/scoped";
import { chunk } from "@/lib/inngest/chunk";
import { inngest } from "@/lib/inngest/client";
import { crawlPageRequested, crawlRunRequested } from "@/lib/inngest/events";
import { auditAiCrawlerAccess } from "@/lib/geo/ai-crawler-audit";
import { childLogger } from "@/lib/observability/logger";
import {
  advanceOperation,
  completeOperation,
  failOperation,
  partialOperation,
  startOperation,
} from "@/lib/operations/service";
import { BrowserRenderClient } from "@/lib/providers/browser/client";
import { CruxClient } from "@/lib/providers/crux/client";
import { writeSnapshot } from "@/lib/storage/blob";

/** A short, stable, bounded-length step id for a URL — full URLs can exceed Inngest's step-id-friendly length. */
function urlStepId(prefix: string, url: string): string {
  return `${prefix}-${createHash("sha1").update(url).digest("hex").slice(0, 16)}`;
}

/**
 * Fetches and processes exactly one page. Per-host concurrency (not
 * per-workspace) is the actual politeness mechanism the plan calls for —
 * two different workspaces crawling the same host still share that host's
 * limit, since politeness is about the target server, not about us.
 */
export const crawlPage = inngest.createFunction(
  {
    id: "crawl-page",
    triggers: [{ event: crawlPageRequested }],
    concurrency: { key: "event.data.host", limit: 2 },
    retries: 2,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data;
      const ctx: WorkspaceContext = {
        workspaceId: original.workspaceId,
        userId: null,
        role: "OWNER",
      };
      const updated = await incrementCrawlRunCounter(
        ctx,
        original.crawlRunId,
        "failedPages",
      );
      const run = await scopedDb(ctx).crawlRun.findFirst({
        where: { id: original.crawlRunId },
        select: { operationId: true },
      });
      if (run) {
        await advanceOperation(ctx, run.operationId, {
          progressCurrent: updated.completedPages + updated.failedPages,
          progressTotal: updated.totalPages,
        });
      }
      childLogger({ fn: "crawlPage", url: original.url }).error(
        { err: error.message },
        "crawl page failed permanently",
      );
    },
  },
  async ({ event, step }) => {
    const { workspaceId, crawlRunId, url } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };

    const fetchOutcome = await step.run("fetch-page", () =>
      fetchPageForCrawl(url),
    );

    if (fetchOutcome.kind === "blocked") {
      throw new NonRetriableError(`Blocked: ${fetchOutcome.reason}`);
    }
    if (fetchOutcome.kind === "error") {
      throw new Error(`Fetch error: ${fetchOutcome.reason}`);
    }

    const processed = await step.run("extract-and-persist", async () => {
      const { result } = fetchOutcome;
      let html = result.html;
      let renderMode: RenderMode = "STATIC";
      let extracted = extractPage(html, result.finalUrl);

      if (needsBrowserRender(html, extracted.wordCount)) {
        try {
          const rendered = await new BrowserRenderClient().render(
            result.finalUrl,
          );
          html = rendered.html;
          renderMode = "BROWSER";
          extracted = extractPage(html, result.finalUrl);
        } catch {
          // Best-effort: no key configured, or the render failed. The
          // static content we already have is still a real observation.
        }
      }

      const raw = await writeSnapshot(ctx, {
        bytes: Buffer.from(html, "utf-8"),
        mimeType: "text/html",
      });

      const snapshot = await persistPageSnapshot(ctx, {
        crawlRunId,
        url: result.finalUrl,
        canonicalUrl: extracted.canonicalUrl,
        contentHash: computeContentHash(html),
        httpStatus: result.httpStatus,
        renderMode,
        rawSnapshotId: raw.id,
      });

      const freshness = resolveFreshness({
        metaPublished: extracted.dateSignals.metaPublished,
        metaModified: extracted.dateSignals.metaModified,
        jsonLdPublished: extracted.dateSignals.jsonLdPublished,
        jsonLdModified: extracted.dateSignals.jsonLdModified,
        httpLastModified: result.lastModified,
      });

      const intent = classifyIntent({
        url: result.finalUrl,
        title: extracted.title,
        headings: extracted.headings.map((heading) => heading.text),
      });

      await persistPageObservation(ctx, {
        snapshotId: snapshot.id,
        extracted,
        freshness,
        intent,
      });

      if (extracted.jsonLd.length > 0) {
        await persistSchemaObservations(
          ctx,
          snapshot.id,
          validateJsonLdBlocks(extracted.jsonLd),
        );
      }

      if (process.env.CRUX_API_KEY) {
        try {
          const metrics = await new CruxClient().queryUrl(result.finalUrl);
          if (metrics) {
            await persistPerformanceObservation(
              ctx,
              snapshot.id,
              metrics,
              "FIELD",
            );
          }
        } catch {
          // Best-effort — CrUX has no field data for many pages; never fail
          // the crawl over a supplementary signal.
        }
      }

      return { snapshotId: snapshot.id };
    });

    const updated = await step.run("advance-progress", () =>
      incrementCrawlRunCounter(ctx, crawlRunId, "completedPages"),
    );
    const run = await step.run("load-run-for-progress", () =>
      scopedDb(ctx).crawlRun.findFirstOrThrow({
        where: { id: crawlRunId },
        select: { operationId: true, totalPages: true },
      }),
    );
    await step.run("advance-operation", () =>
      advanceOperation(ctx, run.operationId, {
        progressCurrent: updated.completedPages + updated.failedPages,
        progressTotal: run.totalPages,
      }),
    );

    return processed;
  },
);

/** How many pages one crawl covers — a representative autopsy sample, not a full-site crawl; see docs/cost-model.md for the 100/250-page production targets this can grow into once the pipeline has run against real sites. */
const CRAWL_PAGE_LIMIT = 50;
const FANOUT_CHUNK_SIZE = 4;
const MAX_SITEMAPS_TO_TRY = 3;
const MAX_SITEMAP_INDEX_CHILDREN = 2;

/**
 * Orchestrates one crawl: fetch robots.txt (cached, and the source for the
 * AI crawler audit), discover URLs from the sitemap(s) it declares (or
 * `/sitemap.xml`, or just the homepage if neither exists), filter to
 * same-host + robots-allowed, then fan out to crawlPage in bounded
 * per-host-throttled groups.
 */
export const crawlRun = inngest.createFunction(
  {
    id: "crawl-run",
    triggers: [{ event: crawlRunRequested }],
    concurrency: { key: "event.data.host", limit: 2 },
    retries: 2,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data;
      const ctx: WorkspaceContext = {
        workspaceId: original.workspaceId,
        userId: null,
        role: "OWNER",
      };
      const run = await scopedDb(ctx).crawlRun.findFirst({
        where: { id: original.crawlRunId },
        select: { operationId: true },
      });
      if (run) {
        await failOperation(ctx, run.operationId, {
          errorCode: "CRAWL_FAILED",
          errorMessage: error.message,
        });
      }
    },
  },
  async ({ event, step }) => {
    const { workspaceId, crawlRunId, host } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };
    const log = childLogger({ crawlRunId, host, fn: "crawlRun" });

    const run = await step.run("load-run", () =>
      scopedDb(ctx).crawlRun.findFirstOrThrow({ where: { id: crawlRunId } }),
    );
    await step.run("start-operation", () =>
      startOperation(ctx, run.operationId),
    );

    const robotsBody = await step.run("fetch-robots", async () => {
      const cached = await getCachedRobots(host);
      if (cached !== null) return cached;

      const outcome = await fetchPageForCrawl(`https://${host}/robots.txt`, {
        allowedContentTypes: null,
      });
      if (outcome.kind !== "ok") return null;

      await cacheRobots(host, outcome.result.html);
      return outcome.result.html;
    });

    await step.run("audit-ai-crawlers", () =>
      persistAiCrawlerAccess(host, auditAiCrawlerAccess(robotsBody)),
    );

    const discoveredUrls = await step.run("discover-urls", async () => {
      const parsedRobots = robotsBody
        ? parseRobotsTxt(robotsBody)
        : { groups: [], sitemaps: [] };
      const sitemapLocations =
        parsedRobots.sitemaps.length > 0
          ? parsedRobots.sitemaps
          : [`https://${host}/sitemap.xml`];

      const discovered = new Map<string, string | null>();

      for (const sitemapUrl of sitemapLocations.slice(0, MAX_SITEMAPS_TO_TRY)) {
        const outcome = await fetchPageForCrawl(sitemapUrl, {
          allowedContentTypes: null,
        });
        if (outcome.kind !== "ok") continue;

        const parsed = parseSitemap(outcome.result.html);
        if (parsed.kind === "urlset") {
          for (const entry of parsed.entries)
            discovered.set(entry.loc, entry.lastmod);
        } else {
          for (const child of parsed.entries.slice(
            0,
            MAX_SITEMAP_INDEX_CHILDREN,
          )) {
            const childOutcome = await fetchPageForCrawl(child.loc, {
              allowedContentTypes: null,
            });
            if (childOutcome.kind !== "ok") continue;
            const childParsed = parseSitemap(childOutcome.result.html);
            if (childParsed.kind === "urlset") {
              for (const entry of childParsed.entries) {
                discovered.set(entry.loc, entry.lastmod);
              }
            }
          }
        }

        if (discovered.size > 0) break;
      }

      if (discovered.size === 0) {
        discovered.set(`https://${host}/`, null);
      }

      return [...discovered.keys()];
    });

    const allowedUrls = discoveredUrls
      .filter((url) => {
        try {
          return new URL(url).hostname.toLowerCase() === host.toLowerCase();
        } catch {
          return false;
        }
      })
      .filter((url) => {
        const path = (() => {
          try {
            return new URL(url).pathname;
          } catch {
            return "/";
          }
        })();
        return isCrawlAllowed(robotsBody, path);
      })
      .slice(0, CRAWL_PAGE_LIMIT);

    await step.run("set-total-pages", () =>
      startCrawlRun(ctx, crawlRunId, allowedUrls.length),
    );

    for (const group of chunk(allowedUrls, FANOUT_CHUNK_SIZE)) {
      await Promise.allSettled(
        group.map((url) =>
          step.invoke(urlStepId("crawl", url), {
            function: crawlPage,
            data: { workspaceId, crawlRunId, url, host },
          }),
        ),
      );
    }

    const finalized = await step.run("finalize", () =>
      finalizeCrawlRun(ctx, crawlRunId),
    );

    await step.run("complete-operation", async () => {
      if (finalized.status === "COMPLETED") {
        await completeOperation(ctx, run.operationId, {
          metadata: { crawlRunId, host, pagesCrawled: allowedUrls.length },
        });
      } else if (finalized.status === "FAILED") {
        await failOperation(ctx, run.operationId, {
          errorCode: "CRAWL_FAILED",
          errorMessage: `All ${allowedUrls.length} pages failed.`,
        });
      } else {
        await partialOperation(ctx, run.operationId, {
          errorCode: "PARTIAL_CRAWL_FAILURE",
          errorMessage: `${finalized.failedPages} of ${finalized.totalPages} pages failed.`,
          metadata: { crawlRunId, host },
        });
      }
    });

    log.info(
      { pagesCrawled: allowedUrls.length, status: finalized.status },
      "crawl run finished",
    );

    return {
      crawlRunId,
      pagesCrawled: allowedUrls.length,
      status: finalized.status,
    };
  },
);
