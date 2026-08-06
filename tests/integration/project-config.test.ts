import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/context";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("project configuration v2", () => {
  let brandService: typeof import("@/lib/brands/service");
  let marketService: typeof import("@/lib/markets/service");
  let keywordService: typeof import("@/lib/keywords/service");
  let competitorService: typeof import("@/lib/competitors/service");
  let database: (typeof import("@/lib/db"))["db"];
  let ctx: WorkspaceContext;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    brandService = await import("@/lib/brands/service");
    marketService = await import("@/lib/markets/service");
    keywordService = await import("@/lib/keywords/service");
    competitorService = await import("@/lib/competitors/service");
    database = (await import("@/lib/db")).db;

    const workspace = await database.workspace.create({
      data: {
        name: `Project Config Test ${suffix}`,
        slug: `project-config-test-${suffix}`,
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
      where: { slug: `project-config-test-${suffix}` },
    });
    await database.$disconnect();
  });

  it("reuses an existing market instead of duplicating it", async () => {
    const first = await marketService.findOrCreateMarket(ctx, {
      country: "US",
      language: "en",
      timezone: "America/Los_Angeles",
    });
    const second = await marketService.findOrCreateMarket(ctx, {
      country: "US",
      language: "en",
      timezone: "America/Los_Angeles",
    });
    expect(second.id).toBe(first.id);

    // A different tuple (region set) is a distinct market.
    const third = await marketService.findOrCreateMarket(ctx, {
      country: "US",
      region: "CA",
      language: "en",
      timezone: "America/Los_Angeles",
    });
    expect(third.id).not.toBe(first.id);
  });

  it("takes a project through the DRAFT review lifecycle to ACTIVE", async () => {
    const draft = await brandService.createBrand(ctx, {
      name: `Voquarn ${suffix}`,
      websiteUrl: `https://voquarn-config-${suffix}.test`,
      description: "A disposable integration-test SaaS project.",
      category: "Integration test software",
      competitors: [
        { name: "Alpha", websiteUrl: `https://alpha-config-${suffix}.test` },
        { name: "Beta", websiteUrl: `https://beta-config-${suffix}.test` },
      ],
    });
    expect(draft.status).toBe("DRAFT");
    expect(draft.competitors.every((c) => c.status === "CANDIDATE")).toBe(true);

    // Draft projects are invisible outside the wizard.
    await expect(brandService.getBrand(ctx, draft.id)).resolves.toBeNull();
    expect(
      (await brandService.listBrands(ctx)).some((b) => b.id === draft.id),
    ).toBe(false);

    const reviewed = await brandService.getBrandForReview(ctx, draft.id);
    expect(reviewed?.id).toBe(draft.id);

    await brandService.updateDraftProfile(ctx, draft.id, {
      description: "A corrected description.",
      category: "Corrected category",
    });

    const alpha = draft.competitors.find((c) => c.name === "Alpha");
    if (!alpha) throw new Error("expected Alpha competitor to exist");
    const beta = draft.competitors.find((c) => c.name === "Beta");
    if (!beta) throw new Error("expected Beta competitor to exist");

    await competitorService.updateCompetitorStatus(ctx, alpha.id, "ACCEPTED");
    await competitorService.updateCompetitorStatus(ctx, beta.id, "IGNORED");

    const market = await marketService.findOrCreateMarket(ctx, {
      country: "GB",
      language: "en",
      timezone: "Europe/London",
    });

    const { linkedCount } = await keywordService.bulkAddKeywords(ctx, {
      brandId: draft.id,
      marketId: market.id,
      keywords: ["GEO tools", "geo   tools", "ai visibility tracking"],
    });
    // "GEO tools" and "geo   tools" normalize to the same keyword.
    expect(linkedCount).toBe(2);

    // Re-running with an overlapping list is idempotent, not additive.
    const repeat = await keywordService.bulkAddKeywords(ctx, {
      brandId: draft.id,
      marketId: market.id,
      keywords: ["geo tools", "a new keyword"],
    });
    expect(repeat.linkedCount).toBe(2);

    const projectKeywords = await keywordService.listProjectKeywords(
      ctx,
      draft.id,
    );
    expect(projectKeywords).toHaveLength(3);

    const activated = await brandService.activateBrand(ctx, draft.id);
    expect(activated.status).toBe("ACTIVE");

    const active = await brandService.getBrand(ctx, draft.id);
    expect(active?.id).toBe(draft.id);
    const activeAlpha = active?.competitors.find((c) => c.name === "Alpha");
    expect(activeAlpha?.status).toBe("ACCEPTED");
    const activeBeta = active?.competitors.find((c) => c.name === "Beta");
    expect(activeBeta?.status).toBe("IGNORED");

    // activateBrand() only transitions DRAFT projects.
    await expect(
      brandService.activateBrand(ctx, draft.id),
    ).rejects.toMatchObject({ code: "BRAND_NOT_FOUND" });

    await brandService.deleteBrand(ctx, draft.id, draft.name);
  });
});
