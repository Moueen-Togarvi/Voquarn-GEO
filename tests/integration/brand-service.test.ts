import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("brand persistence", () => {
  let service: typeof import("@/lib/brands/service");
  let database: (typeof import("@/lib/db"))["db"];
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    service = await import("@/lib/brands/service");
    database = (await import("@/lib/db")).db;
  });

  afterAll(async () => {
    await database.brand.deleteMany({
      where: { domain: { endsWith: `.test` } },
    });
    await database.$disconnect();
  });

  it("creates, reloads, updates, and cascades a project", async () => {
    const created = await service.createBrand({
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

    const updated = await service.updateBrand(created.id, {
      name: created.name,
      websiteUrl: created.websiteUrl,
      description: "An updated disposable integration-test SaaS project.",
      category: "Updated integration software",
      competitors: [
        { name: "Gamma", websiteUrl: `https://gamma-${suffix}.test` },
        { name: "Delta", websiteUrl: `https://delta-${suffix}.test` },
      ],
    });
    expect(updated.competitors.map((item) => item.name)).toEqual([
      "Gamma",
      "Delta",
    ]);

    const deleted = await service.deleteBrand(created.id, created.name);
    expect(deleted.deletedId).toBe(created.id);
    await expect(service.getBrand(created.id)).resolves.toBeNull();
  });
});
