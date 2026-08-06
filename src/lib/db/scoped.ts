import { db } from "@/lib/db";
import type { WorkspaceContext } from "@/lib/auth/context";
import { injectWorkspaceScope, TENANT_MODELS } from "@/lib/db/inject-scope";

/**
 * A Prisma client scoped to one workspace. Every top-level query against a
 * tenant-owned model — reads, creates, updates, deletes — is automatically
 * filtered or stamped with `ctx.workspaceId` at runtime; a caller-supplied
 * workspaceId in `where` or `data` is silently overridden, never merged, so
 * it cannot be used to escape the scope.
 *
 * The safety guarantee is strongest exactly where it matters most: reads,
 * updates, and deletes never need `workspaceId` in `where` for correctness,
 * because Prisma's `where` types make every field optional — an author who
 * forgets it is still fully scoped. `create` is different: Prisma's
 * generated types require `workspaceId` in `data` regardless of what this
 * extension does at runtime (extensions cannot change argument types), so
 * callers must still pass `workspaceId: ctx.workspaceId` explicitly on every
 * create. The extension still overrides a wrong value there, but it cannot
 * remove that one line of boilerplate.
 *
 * What this does NOT cover: nested relation writes (e.g.
 * `brand.create({ data: { competitors: { create: [...] } } })`) are part of
 * the same top-level `create` call, not a separate intercepted operation, so
 * Prisma extensions cannot reach into them. Nested rows on a tenant-owned
 * model still need `workspaceId` set explicitly by the caller. Raw queries
 * are an unscoped escape hatch — filter manually.
 *
 * Import this instead of `@/lib/db` in every service that has a
 * WorkspaceContext. Route handlers and Inngest functions should have no
 * other path to the database.
 *
 * The actual injection logic lives in src/lib/db/inject-scope.ts, a pure
 * module with no Prisma import, so it can be unit tested without a database
 * — see tests/unit/workspace-scope.test.ts.
 */
export function scopedDb(ctx: WorkspaceContext) {
  return db.$extends({
    name: "workspace-scope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) {
            return query(args);
          }

          return query(
            injectWorkspaceScope(
              operation,
              args as Record<string, unknown> | undefined,
              ctx.workspaceId,
            ),
          );
        },
      },
    },
  });
}
