import type {
  CompetitorStatus,
  CompetitorTier,
} from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import type { CompetitorDto } from "@/lib/brands/types";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";
import { domainFromUrl } from "@/lib/validation/brand";
import type { ExpandedCompetitorItem } from "@/lib/validation/competitor";

export async function getCompetitor(
  ctx: WorkspaceContext,
  competitorId: string,
): Promise<CompetitorDto | null> {
  const competitor = await scopedDb(ctx).competitor.findFirst({
    where: { id: competitorId },
  });
  if (!competitor) return null;

  return {
    id: competitor.id,
    name: competitor.name,
    websiteUrl: competitor.websiteUrl,
    domain: competitor.domain,
    country: competitor.country,
    tier: competitor.tier,
    status: competitor.status,
    source: competitor.source,
  };
}

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
      country: competitor.country,
      tier: competitor.tier,
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

/**
 * The review step's bulk accept/ignore action — one updateMany per outcome
 * instead of one query per competitor id, since the expanded tier set can
 * run into the dozens (the original 2-4 flow never needed this).
 */
export async function bulkUpdateCompetitorStatus(
  ctx: WorkspaceContext,
  input: { acceptedIds: string[]; ignoredIds: string[] },
): Promise<void> {
  assertRole(ctx, "EDITOR");

  if (input.acceptedIds.length > 0) {
    await scopedDb(ctx).competitor.updateMany({
      where: { id: { in: input.acceptedIds } },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  }

  if (input.ignoredIds.length > 0) {
    await scopedDb(ctx).competitor.updateMany({
      where: { id: { in: input.ignoredIds } },
      data: { status: "IGNORED" },
    });
  }
}

/**
 * The competitor-expansion write path — upsert-only, never delete. Unlike
 * updateBrand()'s competitor sync (brands/service.ts), this call's input is
 * never the complete competitor set, so a domain missing from `items` must
 * not be treated as "no longer a competitor." On update, only country/tier
 * are touched — status/acceptedAt must survive, since a human's prior
 * accept/ignore decision on an already-known competitor must not be reset
 * by a later "find more competitors" run.
 */
export async function upsertExpandedCompetitors(
  ctx: WorkspaceContext,
  brandId: string,
  tier: CompetitorTier,
  items: ExpandedCompetitorItem[],
): Promise<{ processedCount: number }> {
  assertRole(ctx, "EDITOR");

  const brand = await scopedDb(ctx).brand.findFirstOrThrow({
    where: { id: brandId },
    select: { domain: true, workspaceId: true },
  });

  const existingCount = await scopedDb(ctx).competitor.count({
    where: { brandId, OR: [{ tier: "TOP" }, { tier: null }] },
  });
  const remainingSlots = Math.max(0, 30 - existingCount);

  // Not a created-vs-updated count: this step can be replayed by Inngest
  // (a transient failure partway through re-runs the whole step from the
  // top), and upsert() makes that safe for the DB rows themselves, but a
  // create/update tally taken via a timestamp comparison would double-count
  // or undercount across replays. Reporting how many items this tier's
  // (memoized) LLM call returned is deterministic regardless.
  let processedCount = 0;

  for (const item of items.slice(0, remainingSlots)) {
    const domain = domainFromUrl(item.websiteUrl);
    // Defensive — mirrors brandInputSchema's superRefine in
    // validation/brand.ts, in case the model ignores the "don't include the
    // target company" instruction.
    if (!domain || domain === brand.domain) continue;

    await scopedDb(ctx).competitor.upsert({
      where: { brandId_domain: { brandId, domain } },
      update: { country: item.country ?? null, tier },
      create: {
        name: item.name,
        websiteUrl: item.websiteUrl,
        domain,
        country: item.country ?? null,
        tier,
        brandId,
        workspaceId: brand.workspaceId,
        source: "AI_DISCOVERED",
        status: "CANDIDATE",
      },
    });

    processedCount += 1;
  }

  return { processedCount };
}
