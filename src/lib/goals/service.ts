import type { GoalType } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

export async function createGoal(
  ctx: WorkspaceContext,
  input: { brandId: string; type: GoalType; notes?: string | null },
): Promise<void> {
  await scopedDb(ctx).goal.create({
    data: {
      workspaceId: ctx.workspaceId,
      brandId: input.brandId,
      type: input.type,
      notes: input.notes ?? null,
    },
  });
}
