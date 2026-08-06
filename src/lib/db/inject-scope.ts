/**
 * Every model that carries a plain `workspaceId` scalar column. Workspace
 * itself is the tenant boundary, not a tenant-owned table, and is
 * deliberately excluded — as is RawSnapshotBlob, which is only ever reached
 * through an already-scoped RawSnapshot, and RateLimitBucket, whose key
 * already encodes the workspace where relevant.
 *
 * Member and Invitation are usually written through Better Auth's own
 * organization-plugin routes (via the Prisma adapter, on the raw `db`
 * client, scoped by session — not this extension) rather than through
 * scopedDb; they're included here so any of our own code that queries them
 * directly gets the same guarantee.
 *
 * ProviderModelVersion is deliberately absent — it is a global catalog with
 * no workspaceId column, queried through the plain `db` client, never
 * scopedDb().
 */
export const TENANT_MODELS = new Set([
  "Brand",
  "Competitor",
  "Prompt",
  "AnalysisBatch",
  "PromptRun",
  "RunAnalysis",
  "BenchmarkAggregate",
  "Source",
  "Operation",
  "ProviderCall",
  "RawSnapshot",
  "UsageEvent",
  "AuditEvent",
  "Entitlement",
  "FeatureFlag",
  "Member",
  "Invitation",
  "Market",
  "Site",
  "Topic",
  "Keyword",
  "ProjectKeyword",
  "Goal",
  "BrandVoiceProfile",
]);

const WHERE_SCOPED_OPERATIONS = new Set([
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
]);

/**
 * Pure — no Prisma import, so it is safe to unit test without a database.
 * See src/lib/db/scoped.ts for how this is wired into the actual client.
 */
export function injectWorkspaceScope(
  operation: string,
  args: Record<string, unknown> | undefined,
  workspaceId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const base = args ?? {};

  if (operation === "create") {
    const data = (base.data ?? {}) as Record<string, unknown>;
    return { ...base, data: { ...data, workspaceId } };
  }

  if (operation === "createMany" || operation === "createManyAndReturn") {
    const data = base.data;
    return {
      ...base,
      data: Array.isArray(data)
        ? data.map((row: Record<string, unknown>) => ({ ...row, workspaceId }))
        : { ...((data ?? {}) as Record<string, unknown>), workspaceId },
    };
  }

  if (operation === "upsert") {
    const where = (base.where ?? {}) as Record<string, unknown>;
    const create = (base.create ?? {}) as Record<string, unknown>;
    return {
      ...base,
      where: { ...where, workspaceId },
      create: { ...create, workspaceId },
    };
  }

  if (WHERE_SCOPED_OPERATIONS.has(operation)) {
    const where = (base.where ?? {}) as Record<string, unknown>;
    return { ...base, where: { ...where, workspaceId } };
  }

  // Anything else ($queryRaw, $executeRaw, aggregate helpers not covered
  // above) passes through unscoped — callers using raw SQL must filter by
  // workspaceId themselves.
  return base;
}
