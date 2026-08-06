import type { CompetitorStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import type { CompetitorDto } from "@/lib/brands/types";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";

/**
 * The review step's accept/ignore/pin action. `acceptedAt` is stamped only
 * on the transition into ACCEPTED, mirroring the column's own intent — it
 * records when a human confirmed the competitor, not just its current state.
 */
export async function updateCompetitorStatus(
  ctx: WorkspaceContext,
  competitorId: string,
  status: CompetitorStatus,
): Promise<CompetitorDto> {
  assertRole(ctx, "EDITOR");

  try {
    const competitor = await scopedDb(ctx).competitor.update({
      where: { id: competitorId },
      data: {
        status,
        acceptedAt: status === "ACCEPTED" ? new Date() : undefined,
      },
    });

    return {
      id: competitor.id,
      name: competitor.name,
      websiteUrl: competitor.websiteUrl,
      domain: competitor.domain,
      status: competitor.status,
      source: competitor.source,
    };
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(404, "COMPETITOR_NOT_FOUND", "Competitor not found.");
    }
    throw error;
  }
}
