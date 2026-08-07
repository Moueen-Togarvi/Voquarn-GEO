import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/context";
import type { MappedSerpResult } from "@/lib/providers/scrapedo/mapper";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("hunt service", () => {
  let brandService: typeof import("@/lib/brands/service");
  let marketService: typeof import("@/lib/markets/service");
  let keywordService: typeof import("@/lib/keywords/service");
  let competitorService: typeof import("@/lib/competitors/service");
  let huntService: typeof import("@/lib/hunt/service");
  let database: (typeof import("@/lib/db"))["db"];
  let ctx: WorkspaceContext;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    brandService = await import("@/lib/brands/service");
    marketService = await import("@/lib/markets/service");
    keywordService = await import("@/lib/keywords/service");
    competitorService = await import("@/lib/competitors/service");
    huntService = await import("@/lib/hunt/service");
    database = (await import("@/lib/db")).db;

    const workspace = await database.workspace.create({
      data: {
        name: `Hunt Service Test ${suffix}`,
        slug: `hunt-service-test-${suffix}`,
      },
    });
    ctx = { workspaceId: workspace.id, userId: null, role: "OWNER" };
  });

  afterAll(async () => {
    await database.brand.deleteMany({
      where: { domain: { endsWith: `.test` } },
    });
    await database.market.deleteMany({
      where: { workspaceId: ctx.workspaceId },
    });
    await database.workspace.deleteMany({
      where: { slug: `hunt-service-test-${suffix}` },
    });
    await database.$disconnect();
  });

  it("hunts a keyword, records competitor observations, and computes a deterministic threat score", async () => {
    const draft = await brandService.createBrand(ctx, {
      name: `Hunted${suffix}`,
      websiteUrl: `https://hunted-${suffix}.test`,
      description: "A disposable integration-test SaaS project.",
      category: "Integration test software",
      competitors: [
        { name: "Rival One", websiteUrl: `https://rival-one-${suffix}.test` },
      ],
    });

    const market = await marketService.findOrCreateMarket(ctx, {
      country: "US",
      language: "en",
      timezone: "America/Los_Angeles",
    });
    await brandService.setBrandMarket(ctx, draft.id, {
      defaultMarketId: market.id,
      timezone: "America/Los_Angeles",
    });
    const brand = await brandService.activateBrand(ctx, draft.id);

    const rival = brand.competitors.find((c) => c.name === "Rival One");
    if (!rival) throw new Error("expected Rival One to exist");
    await competitorService.updateCompetitorStatus(ctx, rival.id, "ACCEPTED");

    await keywordService.bulkAddKeywords(ctx, {
      brandId: brand.id,
      marketId: market.id,
      keywords: ["best hunted software"],
    });
    const [projectKeyword] = await keywordService.listProjectKeywords(
      ctx,
      brand.id,
    );
    if (!projectKeyword) throw new Error("expected a tracked keyword");

    const rivalDomain = `rival-one-${suffix}.test`;
    const unrelatedDomain = `unrelated-${suffix}.test`;

    const results: MappedSerpResult[] = [
      // Best-of-two: the lower position for the rival domain should win.
      {
        position: 5,
        url: `https://${rivalDomain}/page-a`,
        domain: rivalDomain,
        registrableDomain: rivalDomain,
        title: "Rival page A",
        snippet: null,
        type: "ORGANIC",
      },
      {
        position: 2,
        url: `https://${rivalDomain}/page-b`,
        domain: rivalDomain,
        registrableDomain: rivalDomain,
        title: "Rival page B",
        snippet: null,
        type: "ORGANIC",
      },
      // The brand's own domain must never become a competitor observation.
      {
        position: 1,
        url: `https://hunted-${suffix}.test/`,
        domain: `hunted-${suffix}.test`,
        registrableDomain: `hunted-${suffix}.test`,
        title: "Our own site",
        snippet: null,
        type: "ORGANIC",
      },
      // A domain with no matching Competitor row — still recorded as a candidate.
      {
        position: 8,
        url: `https://${unrelatedDomain}/`,
        domain: unrelatedDomain,
        registrableDomain: unrelatedDomain,
        title: "Unrelated result",
        snippet: null,
        type: "ORGANIC",
      },
    ];

    const snapshot = await huntService.persistSerpSnapshot(ctx, {
      keywordId: projectKeyword.keyword.id,
      marketId: market.id,
      device: "DESKTOP",
      providerCallId: null,
      rawSnapshotId: null,
      results,
      resultCount: results.length,
    });

    await huntService.recordCompetitorObservations(ctx, {
      brandId: brand.id,
      keywordId: projectKeyword.keyword.id,
      snapshotId: snapshot.id,
      results,
    });

    const observations = await database.competitorObservation.findMany({
      where: { snapshotId: snapshot.id },
    });
    // Two candidate domains (rival deduped to its best position, plus the
    // unrelated one) — the brand's own domain must be excluded.
    expect(observations).toHaveLength(2);
    const rivalObservation = observations.find(
      (o) => o.candidateDomain === rivalDomain,
    );
    expect(rivalObservation?.position).toBe(2);
    expect(rivalObservation?.competitorId).toBe(rival.id);
    const unrelatedObservation = observations.find(
      (o) => o.candidateDomain === unrelatedDomain,
    );
    expect(unrelatedObservation?.competitorId).toBeNull();

    const scoreDefinitionId =
      await huntService.getOrCreateThreatScoreDefinitionId();

    const first = await huntService.computeAndStoreThreatScore(ctx, {
      brandId: brand.id,
      competitorId: rival.id,
      scoreDefinitionId,
    });
    const second = await huntService.computeAndStoreThreatScore(ctx, {
      brandId: brand.id,
      competitorId: rival.id,
      scoreDefinitionId,
    });

    // Recomputing from the same underlying evidence is deterministic —
    // byte-identical value/confidence/components — even though each call
    // appends a new row rather than upserting.
    expect(second.value).toBe(first.value);
    expect(second.confidence).toBe(first.confidence);
    expect(second.components).toEqual(first.components);
    expect(second.id).not.toBe(first.id);

    const storedScores = await database.threatScore.findMany({
      where: { competitorId: rival.id },
    });
    expect(storedScores).toHaveLength(2);

    // serpOverlap: 1 of 1 tracked keyword -> full weight, maxed.
    expect(first.components.serpOverlap.value).toBe(1);
    expect(first.components.authorityProxy.value).toBeNull();

    const withScores = await huntService.listCompetitorsWithLatestScore(
      ctx,
      brand.id,
    );
    const rivalSummary = withScores.find((c) => c.id === rival.id);
    expect(rivalSummary?.latestScore?.id).toBe(second.id);

    const evidence = await huntService.getCompetitorEvidence(ctx, rival.id);
    expect(evidence?.observations.length).toBeGreaterThan(0);
    expect(evidence?.scoreHistory).toHaveLength(2);
  });

  it("reuses a cached snapshot within the TTL instead of requiring a new fetch", async () => {
    const draft = await brandService.createBrand(ctx, {
      name: `Cached${suffix}`,
      websiteUrl: `https://cached-${suffix}.test`,
      description: "A disposable integration-test SaaS project.",
      category: "Integration test software",
      competitors: [],
    });
    const market = await marketService.findOrCreateMarket(ctx, {
      country: "GB",
      language: "en",
      timezone: "Europe/London",
    });
    await keywordService.bulkAddKeywords(ctx, {
      brandId: draft.id,
      marketId: market.id,
      keywords: ["cached keyword"],
    });
    const [projectKeyword] = await keywordService.listProjectKeywords(
      ctx,
      draft.id,
    );
    if (!projectKeyword) throw new Error("expected a tracked keyword");

    const before = await huntService.findRecentSnapshot(ctx, {
      keywordId: projectKeyword.keyword.id,
      marketId: market.id,
      device: "DESKTOP",
    });
    expect(before).toBeNull();

    const snapshot = await huntService.persistSerpSnapshot(ctx, {
      keywordId: projectKeyword.keyword.id,
      marketId: market.id,
      device: "DESKTOP",
      providerCallId: null,
      rawSnapshotId: null,
      results: [],
      resultCount: 0,
    });

    const cached = await huntService.findRecentSnapshot(ctx, {
      keywordId: projectKeyword.keyword.id,
      marketId: market.id,
      device: "DESKTOP",
    });
    expect(cached?.id).toBe(snapshot.id);

    const expired = await huntService.findRecentSnapshot(ctx, {
      keywordId: projectKeyword.keyword.id,
      marketId: market.id,
      device: "DESKTOP",
      ttlHours: 0,
    });
    expect(expired).toBeNull();
  });
});
