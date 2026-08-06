import { describe, expect, it } from "vitest";

import { injectWorkspaceScope } from "@/lib/db/inject-scope";

const WORKSPACE_ID = "ws_123";

describe("injectWorkspaceScope", () => {
  it("stamps workspaceId onto a create's data", () => {
    const result = injectWorkspaceScope(
      "create",
      { data: { name: "Acme" } },
      WORKSPACE_ID,
    );
    expect(result).toEqual({
      data: { name: "Acme", workspaceId: WORKSPACE_ID },
    });
  });

  it("overrides rather than trusts a caller-supplied workspaceId on create", () => {
    const result = injectWorkspaceScope(
      "create",
      { data: { name: "Acme", workspaceId: "attacker-controlled" } },
      WORKSPACE_ID,
    );
    expect(result.data.workspaceId).toBe(WORKSPACE_ID);
  });

  it("stamps every row of a createMany, not just the first", () => {
    const result = injectWorkspaceScope(
      "createMany",
      { data: [{ name: "A" }, { name: "B", workspaceId: "attacker" }] },
      WORKSPACE_ID,
    );
    expect(result.data).toEqual([
      { name: "A", workspaceId: WORKSPACE_ID },
      { name: "B", workspaceId: WORKSPACE_ID },
    ]);
  });

  it("injects workspaceId into where for every read/update/delete operation, preserving other filters", () => {
    const readOps = [
      "findFirst",
      "findFirstOrThrow",
      "findMany",
      "findUnique",
      "findUniqueOrThrow",
      "count",
      "aggregate",
      "groupBy",
      "update",
      "updateMany",
      "delete",
      "deleteMany",
    ];

    for (const operation of readOps) {
      const result = injectWorkspaceScope(
        operation,
        { where: { id: "brand_1" } },
        WORKSPACE_ID,
      );
      expect(result.where).toEqual({
        id: "brand_1",
        workspaceId: WORKSPACE_ID,
      });
    }
  });

  it("injects workspaceId even when the caller passed no where at all", () => {
    const result = injectWorkspaceScope("findMany", {}, WORKSPACE_ID);
    expect(result.where).toEqual({ workspaceId: WORKSPACE_ID });
  });

  it("overrides a caller-supplied workspaceId in where rather than merging it", () => {
    const result = injectWorkspaceScope(
      "findFirst",
      { where: { id: "brand_1", workspaceId: "attacker-controlled" } },
      WORKSPACE_ID,
    );
    expect(result.where.workspaceId).toBe(WORKSPACE_ID);
  });

  it("scopes both where and create on upsert", () => {
    const result = injectWorkspaceScope(
      "upsert",
      {
        where: { id: "brand_1" },
        create: { name: "Acme" },
        update: { name: "Acme Inc" },
      },
      WORKSPACE_ID,
    );
    expect(result.where).toEqual({ id: "brand_1", workspaceId: WORKSPACE_ID });
    expect(result.create).toEqual({ name: "Acme", workspaceId: WORKSPACE_ID });
    // update has no independent workspaceId column to enforce — it can only
    // touch the row already matched by the scoped where above.
    expect(result.update).toEqual({ name: "Acme Inc" });
  });

  it("passes through unrecognized operations unscoped, as the documented raw-query escape hatch", () => {
    const args = { sql: "SELECT 1" };
    const result = injectWorkspaceScope("$queryRaw", args, WORKSPACE_ID);
    expect(result).toBe(args);
  });
});
