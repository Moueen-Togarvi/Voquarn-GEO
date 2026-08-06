import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/context";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const suffix = Date.now().toString(36);

describe.skipIf(!hasTestDatabase)("tenant isolation and operations", () => {
  let brandService: typeof import("@/lib/brands/service");
  let operationsService: typeof import("@/lib/operations/service");
  let entitlements: typeof import("@/lib/usage/entitlements");
  let database: (typeof import("@/lib/db"))["db"];
  let ctxA: WorkspaceContext;
  let ctxB: WorkspaceContext;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    brandService = await import("@/lib/brands/service");
    operationsService = await import("@/lib/operations/service");
    entitlements = await import("@/lib/usage/entitlements");
    database = (await import("@/lib/db")).db;

    const workspaceA = await database.workspace.create({
      data: { name: `Tenant A ${suffix}`, slug: `tenant-a-${suffix}` },
    });
    const workspaceB = await database.workspace.create({
      data: { name: `Tenant B ${suffix}`, slug: `tenant-b-${suffix}` },
    });
    ctxA = { workspaceId: workspaceA.id, userId: null, role: "OWNER" };
    ctxB = { workspaceId: workspaceB.id, userId: null, role: "OWNER" };
  });

  afterAll(async () => {
    await database.brand.deleteMany({
      where: { domain: { endsWith: ".test" } },
    });
    await database.workspace.deleteMany({
      where: { slug: { in: [`tenant-a-${suffix}`, `tenant-b-${suffix}`] } },
    });
    await database.$disconnect();
  });

  it("never lets workspace B read, mutate, or enumerate workspace A's brand", async () => {
    const brand = await brandService.createBrand(ctxA, {
      name: `Isolated Brand ${suffix}`,
      websiteUrl: `https://isolated-${suffix}.test`,
      description: "Exists only in workspace A.",
      category: "Integration test software",
      competitors: [
        { name: "Alpha", websiteUrl: `https://iso-alpha-${suffix}.test` },
        { name: "Beta", websiteUrl: `https://iso-beta-${suffix}.test` },
      ],
    });

    // Read: workspace B gets null, not workspace A's row.
    await expect(brandService.getBrand(ctxB, brand.id)).resolves.toBeNull();

    // Enumerate: workspace B's list never includes it.
    const listB = await brandService.listBrands(ctxB);
    expect(listB.some((b) => b.id === brand.id)).toBe(false);

    // Mutate: workspace B's update targets nothing, so the row is untouched.
    await expect(
      brandService.updateBrand(ctxB, brand.id, {
        name: "Hijacked",
        websiteUrl: brand.websiteUrl,
        description: "Should never apply.",
        category: "Hijacked",
        competitors: [
          { name: "X", websiteUrl: `https://x-${suffix}.test` },
          { name: "Y", websiteUrl: `https://y-${suffix}.test` },
        ],
      }),
    ).rejects.toMatchObject({ code: "BRAND_NOT_FOUND" });

    // Delete: same — workspace B cannot touch it.
    await expect(
      brandService.deleteBrand(ctxB, brand.id, brand.name),
    ).rejects.toMatchObject({ code: "BRAND_NOT_FOUND" });

    // Workspace A can still read its own row untouched.
    const stillThere = await brandService.getBrand(ctxA, brand.id);
    expect(stillThere?.name).toBe(`Isolated Brand ${suffix}`);
  });

  it("takes an operation through its full lifecycle and enforces workspace scope", async () => {
    const operation = await operationsService.createOperation(ctxA, {
      kind: "BRAND_DISCOVERY",
      progressTotal: 3,
    });
    expect(operation.status).toBe("PENDING");

    // Workspace B cannot see or cancel workspace A's operation.
    await expect(
      operationsService.getOperation(ctxB, operation.id),
    ).resolves.toBeNull();
    await expect(
      operationsService.cancelOperation(ctxB, operation.id),
    ).rejects.toMatchObject({ code: "OPERATION_NOT_FOUND" });

    const running = await operationsService.startOperation(ctxA, operation.id);
    expect(running.status).toBe("RUNNING");
    expect(running.startedAt).not.toBeNull();

    const advanced = await operationsService.advanceOperation(
      ctxA,
      operation.id,
      {
        progressCurrent: 2,
      },
    );
    expect(advanced.progressCurrent).toBe(2);

    const completed = await operationsService.completeOperation(
      ctxA,
      operation.id,
      {
        metadata: { brandId: "brand_example" },
      },
    );
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();
    expect(completed.metadata).toEqual({ brandId: "brand_example" });

    // Cancelling an already-terminal operation is a no-op, not an error.
    const cancelledAfterComplete = await operationsService.cancelOperation(
      ctxA,
      operation.id,
    );
    expect(cancelledAfterComplete.status).toBe("COMPLETED");
  });

  it("marks a failed operation with its error code and message", async () => {
    const operation = await operationsService.createOperation(ctxA, {
      kind: "BRAND_DISCOVERY",
    });

    const failed = await operationsService.failOperation(ctxA, operation.id, {
      errorCode: "DISCOVERY_FAILED",
      errorMessage: "The provider timed out.",
    });

    expect(failed.status).toBe("FAILED");
    expect(failed.errorCode).toBe("DISCOVERY_FAILED");
    expect(failed.errorMessage).toBe("The provider timed out.");
  });

  it("enforces the default per-workspace brand limit", async () => {
    const limits = await entitlements.getEntitlementLimits(ctxB);
    expect(limits.brands).toBeGreaterThan(0);

    for (let i = 0; i < limits.brands; i += 1) {
      await brandService.createBrand(ctxB, {
        name: `Limit Brand ${suffix}-${i}`,
        websiteUrl: `https://limit-${suffix}-${i}.test`,
        description: "Fills the default entitlement.",
        category: "Integration test software",
        competitors: [
          {
            name: "Alpha",
            websiteUrl: `https://limit-alpha-${suffix}-${i}.test`,
          },
          {
            name: "Beta",
            websiteUrl: `https://limit-beta-${suffix}-${i}.test`,
          },
        ],
      });
    }

    await expect(
      brandService.createBrand(ctxB, {
        name: `Over Limit ${suffix}`,
        websiteUrl: `https://over-limit-${suffix}.test`,
        description: "Should be rejected by the entitlement check.",
        category: "Integration test software",
        competitors: [
          { name: "Alpha", websiteUrl: `https://over-alpha-${suffix}.test` },
          { name: "Beta", websiteUrl: `https://over-beta-${suffix}.test` },
        ],
      }),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });

    // Workspace A is unaffected by workspace B's usage — the limit is per
    // workspace, not global.
    await expect(
      brandService.createBrand(ctxA, {
        name: `Unaffected Brand ${suffix}`,
        websiteUrl: `https://unaffected-${suffix}.test`,
        description: "Workspace A still has headroom.",
        category: "Integration test software",
        competitors: [
          { name: "Alpha", websiteUrl: `https://unaff-alpha-${suffix}.test` },
          { name: "Beta", websiteUrl: `https://unaff-beta-${suffix}.test` },
        ],
      }),
    ).resolves.toMatchObject({ name: `Unaffected Brand ${suffix}` });
  });

  it("gates brand mutations by role, in the same workspace a VIEWER can still read", async () => {
    const viewer: WorkspaceContext = {
      workspaceId: ctxA.workspaceId,
      userId: null,
      role: "VIEWER",
    };
    const editor: WorkspaceContext = {
      workspaceId: ctxA.workspaceId,
      userId: null,
      role: "EDITOR",
    };
    const admin: WorkspaceContext = {
      workspaceId: ctxA.workspaceId,
      userId: null,
      role: "ADMIN",
    };

    const input = {
      name: `Role Gated Brand ${suffix}`,
      websiteUrl: `https://role-gated-${suffix}.test`,
      description: "Exercises assertRole() through the real service layer.",
      category: "Integration test software",
      competitors: [
        { name: "Alpha", websiteUrl: `https://role-alpha-${suffix}.test` },
        { name: "Beta", websiteUrl: `https://role-beta-${suffix}.test` },
      ],
    };

    // VIEWER cannot create.
    await expect(brandService.createBrand(viewer, input)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );

    // A read is not gated by role — every member can see the workspace's data.
    await expect(brandService.listBrands(viewer)).resolves.toBeInstanceOf(
      Array,
    );

    // EDITOR can create and update, but not delete.
    const created = await brandService.createBrand(editor, input);
    await expect(
      brandService.updateBrand(editor, created.id, {
        ...input,
        description: "Updated by an EDITOR.",
      }),
    ).resolves.toMatchObject({ description: "Updated by an EDITOR." });
    await expect(
      brandService.deleteBrand(editor, created.id, created.name),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // ADMIN can do all three, including the delete EDITOR was refused.
    await expect(
      brandService.deleteBrand(admin, created.id, created.name),
    ).resolves.toMatchObject({ deletedId: created.id });
  });
});
