import type { Prisma } from "@/generated/prisma/client";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

/**
 * Appends an audit trail entry. Call this from services after a mutation
 * succeeds, not from route handlers — the service is what knows the target
 * type and id, and callers should not need to duplicate that.
 */
export async function recordAudit(
  ctx: WorkspaceContext,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await scopedDb(ctx).auditEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    },
  });
}
