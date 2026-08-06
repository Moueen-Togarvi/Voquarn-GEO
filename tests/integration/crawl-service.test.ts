import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/context";
import type { ExtractedPage } from "@/lib/crawl/extract";
import type { FreshnessResult } from "@/lib/crawl/freshness";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("crawl service", () => {
  let brandService: typeof import("@/lib/brands/service");
  let operationService: typeof import("@/lib/operations/service");
  let crawlService: typeof import("@/lib/crawl/service");
  let database: (typeof import("@/lib/db"))["db"];
  let ctx: WorkspaceContext;
  const suffix = Date.now().toString(36);
  const host = `crawl-target-${suffix}.test`;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    brandService = await import("@/lib/brands/service");
    operationService = await import("@/lib/operations/service");
    crawlService = await import("@/lib/crawl/service");
    database = (await import("@/lib/db")).db;

    const workspace = await database.workspace.create({
      data: {
        name: `Crawl Service Test ${suffix}`,
        slug: `crawl-service-test-${suffix}`,
      },
    });
    ctx = { workspaceId: workspace.id, userId: null, role: "OWNER" };
  });

  afterAll(async () => {
    await database.robotsCache.deleteMany({ where: { host } });
    await database.aiCrawlerAccess.deleteMany({
      where: { domain: host },
    });
    await database.brand.deleteMany({
      where: { domain: { endsWith: `.test` } },
    });
    await database.workspace.deleteMany({
      where: { slug: `crawl-service-test-${suffix}` },
    });
    await database.$disconnect();
  });

  it("runs a CrawlRun lifecycle and persists snapshots, observations, schemas, and performance", async () => {
    const brand = await brandService.createBrand(ctx, {
      name: `Crawled${suffix}`,
      websiteUrl: `https://${host}`,
      description: "A disposable integration-test SaaS project.",
      category: "Integration test software",
      competitors: [],
    });

    const operation = await operationService.createOperation(ctx, {
      kind: "CRAWL",
      brandId: brand.id,
    });

    const run = await crawlService.createCrawlRun(ctx, {
      host,
      brandId: brand.id,
      operationId: operation.id,
    });
    expect(run.status).toBe("PENDING");

    await crawlService.startCrawlRun(ctx, run.id, 2);

    const extracted: ExtractedPage = {
      title: "Home",
      description: "A test page",
      canonicalUrl: `https://${host}/`,
      headings: [{ level: 1, text: "Welcome" }],
      wordCount: 240,
      internalLinks: 3,
      externalLinks: 1,
      mediaCounts: { images: 2, videos: 0, audio: 0 },
      jsonLd: [],
      dateSignals: {
        metaPublished: null,
        metaModified: null,
        jsonLdPublished: null,
        jsonLdModified: null,
      },
    };
    const freshness: FreshnessResult = {
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      modifiedAt: null,
      confidence: 0.4,
    };

    const snapshot = await crawlService.persistPageSnapshot(ctx, {
      crawlRunId: run.id,
      url: `https://${host}/`,
      canonicalUrl: extracted.canonicalUrl,
      contentHash: crawlService.computeContentHash("<html>ok</html>"),
      httpStatus: 200,
      renderMode: "STATIC",
      rawSnapshotId: null,
    });

    await crawlService.persistPageObservation(ctx, {
      snapshotId: snapshot.id,
      extracted,
      freshness,
      intent: "INFORMATIONAL",
    });

    await crawlService.persistSchemaObservations(ctx, snapshot.id, [
      { type: "Organization", valid: true, mismatches: [] },
    ]);

    await crawlService.persistPerformanceObservation(
      ctx,
      snapshot.id,
      { lcp: 2100, inp: 150, cls: 0.05 },
      "FIELD",
    );

    await crawlService.incrementCrawlRunCounter(ctx, run.id, "completedPages");
    // A second page that failed to fetch — never got a PageSnapshot.
    await crawlService.incrementCrawlRunCounter(ctx, run.id, "failedPages");

    const finalized = await crawlService.finalizeCrawlRun(ctx, run.id);
    expect(finalized.status).toBe("PARTIAL_FAILURE");
    expect(finalized.completedAt).not.toBeNull();

    const detail = await crawlService.getPageSnapshot(ctx, snapshot.id);
    expect(detail?.observation?.title).toBe("Home");
    expect(detail?.observation?.wordCount).toBe(240);
    expect(detail?.observation?.intent).toBe("INFORMATIONAL");
    expect(detail?.schemas).toHaveLength(1);
    expect(detail?.performance).toHaveLength(1);
    expect(detail?.performance[0]?.lcp).toBe(2100);

    const listed = await crawlService.listPageSnapshotsForCrawlRun(ctx, run.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(snapshot.id);

    const latest = await crawlService.getLatestCrawlRun(ctx, {
      brandId: brand.id,
    });
    expect(latest?.id).toBe(run.id);

    const runs = await crawlService.listCrawlRuns(ctx, { brandId: brand.id });
    expect(runs.map((r) => r.id)).toContain(run.id);
  });

  it("caches robots.txt globally with a TTL and records AI crawler access", async () => {
    const before = await crawlService.getCachedRobots(host);
    expect(before).toBeNull();

    await crawlService.cacheRobots(host, "User-agent: *\nDisallow: /admin");
    const cached = await crawlService.getCachedRobots(host);
    expect(cached).toBe("User-agent: *\nDisallow: /admin");

    await crawlService.persistAiCrawlerAccess(host, [
      { botName: "GPTBot", allowed: true, evidence: "no matching rule" },
      { botName: "ClaudeBot", allowed: false, evidence: "Disallow: /" },
    ]);
    // Upsert on a repeat audit should update, not duplicate.
    await crawlService.persistAiCrawlerAccess(host, [
      { botName: "GPTBot", allowed: false, evidence: "Disallow: /" },
    ]);

    const access = await crawlService.getAiCrawlerAccess(host);
    expect(access).toHaveLength(2);
    const gptBot = access.find((a) => a.botName === "GPTBot");
    expect(gptBot?.allowed).toBe(false);
  });
});
