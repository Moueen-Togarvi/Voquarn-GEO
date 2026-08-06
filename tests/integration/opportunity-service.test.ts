import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/context";
import type { DetectedGap } from "@/lib/opportunity/types";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("opportunity service", () => {
  let brandService: typeof import("@/lib/brands/service");
  let competitorService: typeof import("@/lib/competitors/service");
  let opportunityService: typeof import("@/lib/opportunity/service");
  let database: (typeof import("@/lib/db"))["db"];
  let ctx: WorkspaceContext;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    brandService = await import("@/lib/brands/service");
    competitorService = await import("@/lib/competitors/service");
    opportunityService = await import("@/lib/opportunity/service");
    database = (await import("@/lib/db")).db;

    const workspace = await database.workspace.create({
      data: {
        name: `Opportunity Service Test ${suffix}`,
        slug: `opportunity-service-test-${suffix}`,
      },
    });
    ctx = { workspaceId: workspace.id, userId: null, role: "OWNER" };
  });

  afterAll(async () => {
    await database.brand.deleteMany({
      where: { domain: { endsWith: `.test` } },
    });
    await database.scoreDefinition.deleteMany({
      where: { name: "opportunity-v1" },
    });
    await database.workspace.deleteMany({
      where: { slug: `opportunity-service-test-${suffix}` },
    });
    await database.$disconnect();
  });

  it("resolves the same global ScoreDefinition on repeated calls", async () => {
    const first =
      await opportunityService.getOrCreateOpportunityScoreDefinitionId();
    const second =
      await opportunityService.getOrCreateOpportunityScoreDefinitionId();
    expect(second).toBe(first);
  });

  it("creates a new opportunity, skips a duplicate by dedupeKey, and supports the full decision + plan flow", async () => {
    const brand = await brandService.createBrand(ctx, {
      name: `Gapped${suffix}`,
      websiteUrl: `https://gapped-${suffix}.test`,
      description: "A disposable integration-test SaaS project.",
      category: "Integration test software",
      competitors: [
        { name: "Rival One", websiteUrl: `https://rival-gap-${suffix}.test` },
      ],
    });
    const rival = brand.competitors.find((c) => c.name === "Rival One");
    if (!rival) throw new Error("expected Rival One to exist");
    await competitorService.updateCompetitorStatus(ctx, rival.id, "ACCEPTED");

    const scoreDefinitionId =
      await opportunityService.getOrCreateOpportunityScoreDefinitionId();

    const gap: DetectedGap = {
      kind: "MISSING_COVERAGE",
      dedupeKey: `MISSING_COVERAGE:topic_${suffix}:-:-`,
      title: `No content for "Widget maintenance"`,
      summary: "Rival One covers this topic. You have none.",
      recommendedActions: ['Draft a new page targeting "widget maintenance"'],
      components: {
        gapSeverity: 1,
        competitiveCoverage: 0.5,
        keywordPriority: 1,
        evidenceStrength: 0.2,
        citationPressure: null,
      },
      topicId: null,
      keywordId: null,
      competitorId: rival.id,
      evidence: [
        {
          kind: "COMPETITOR_PAGE",
          sourceTable: "PageSnapshot",
          sourceId: `snapshot_${suffix}`,
          url: `https://rival-gap-${suffix}.test/widget-maintenance`,
          note: "Rival One covers this topic",
        },
      ],
    };

    const created = await opportunityService.createOpportunityIfNew(ctx, {
      brandId: brand.id,
      gap,
      scoreDefinitionId,
    });
    expect(created).not.toBeNull();
    expect(created?.score).toBeGreaterThan(0);
    expect(created?.status).toBe("NEW");

    // Same dedupeKey, same brand — must be skipped, not duplicated or
    // upserted, which is the entire point of dedupeKey.
    const duplicate = await opportunityService.createOpportunityIfNew(ctx, {
      brandId: brand.id,
      gap,
      scoreDefinitionId,
    });
    expect(duplicate).toBeNull();

    const listed = await opportunityService.listOpportunities(ctx, {
      brandId: brand.id,
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created?.id);

    const detail = await opportunityService.getOpportunity(ctx, created!.id);
    expect(detail?.evidence).toHaveLength(1);
    expect(detail?.evidence[0]?.sourceTable).toBe("PageSnapshot");
    expect(detail?.decisions).toHaveLength(0);

    // Dismissing appends a decision and updates status — dismissing again
    // must not recreate the opportunity on a later detection pass (that's
    // exactly what the dedupeKey unique constraint already proved above).
    const dismissed = await opportunityService.recordOpportunityDecision(
      ctx,
      created!.id,
      { status: "DISMISSED", reason: "Not a priority right now" },
    );
    expect(dismissed.status).toBe("DISMISSED");

    const afterDecision = await opportunityService.getOpportunity(
      ctx,
      created!.id,
    );
    expect(afterDecision?.decisions).toHaveLength(1);
    expect(afterDecision?.decisions[0]?.status).toBe("DISMISSED");
    expect(afterDecision?.decisions[0]?.reason).toBe(
      "Not a priority right now",
    );

    // Re-accept it, then add it to this week's plan.
    await opportunityService.recordOpportunityDecision(ctx, created!.id, {
      status: "ACCEPTED",
    });

    const planItem = await opportunityService.addPlanItem(ctx, {
      brandId: brand.id,
      opportunityId: created!.id,
    });
    expect(planItem.opportunity.id).toBe(created?.id);

    const { plan, items } = await opportunityService.listCurrentPlanItems(
      ctx,
      brand.id,
    );
    expect(plan.brandId).toBe(brand.id);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe(planItem.id);

    // Adding the same opportunity to the same week's plan twice is a
    // conflict, not a silent duplicate.
    await expect(
      opportunityService.addPlanItem(ctx, {
        brandId: brand.id,
        opportunityId: created!.id,
      }),
    ).rejects.toThrow();

    await opportunityService.removePlanItem(ctx, planItem.id);
    const afterRemoval = await opportunityService.listCurrentPlanItems(
      ctx,
      brand.id,
    );
    expect(afterRemoval.items).toHaveLength(0);
  });
});
