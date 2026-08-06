import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/context";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("brand persistence", () => {
  let service: typeof import("@/lib/brands/service");
  let database: (typeof import("@/lib/db"))["db"];
  let ctx: WorkspaceContext;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    service = await import("@/lib/brands/service");
    database = (await import("@/lib/db")).db;

    // requireWorkspaceContext() now needs a real Better Auth session (no
    // headers/cookies exist in a Vitest run), so this constructs a context
    // directly against a disposable workspace — the same pattern
    // tests/integration/tenant-isolation.test.ts uses. This test exercises
    // the brand service, not the auth layer.
    const workspace = await database.workspace.create({
      data: {
        name: `Brand Service Test ${suffix}`,
        slug: `brand-service-test-${suffix}`,
      },
    });
    ctx = { workspaceId: workspace.id, userId: null, role: "OWNER" };
  });

  afterAll(async () => {
    await database.brand.deleteMany({
      where: { domain: { endsWith: `.test` } },
    });
    await database.workspace.deleteMany({
      where: { slug: `brand-service-test-${suffix}` },
    });
    await database.$disconnect();
  });

  it("creates, reloads, updates, and cascades a project", async () => {
    const created = await service.createBrand(ctx, {
      name: `Voquarn ${suffix}`,
      websiteUrl: `https://voquarn-${suffix}.test`,
      description: "A disposable integration-test SaaS project.",
      category: "Integration test software",
      competitors: [
        { name: "Alpha", websiteUrl: `https://alpha-${suffix}.test` },
        { name: "Beta", websiteUrl: `https://beta-${suffix}.test` },
      ],
    });
    expect(created.competitors).toHaveLength(2);
    const alphaId = created.competitors.find((c) => c.name === "Alpha")?.id;

    const updated = await service.updateBrand(ctx, created.id, {
      name: created.name,
      websiteUrl: created.websiteUrl,
      description: "An updated disposable integration-test SaaS project.",
      category: "Updated integration software",
      competitors: [
        // Alpha is kept (same domain, renamed) — its id must survive the
        // update. Beta is dropped and Gamma is added.
        { name: "Alpha Renamed", websiteUrl: `https://alpha-${suffix}.test` },
        { name: "Gamma", websiteUrl: `https://gamma-${suffix}.test` },
      ],
    });
    expect(updated.competitors.map((item) => item.name).sort()).toEqual([
      "Alpha Renamed",
      "Gamma",
    ]);
    const renamedAlpha = updated.competitors.find(
      (c) => c.name === "Alpha Renamed",
    );
    expect(renamedAlpha?.id).toBe(alphaId);

    const deleted = await service.deleteBrand(ctx, created.id, created.name);
    expect(deleted.deletedId).toBe(created.id);
    await expect(service.getBrand(ctx, created.id)).resolves.toBeNull();
  });
});
