import type { Brand, Competitor } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { recordAudit } from "@/lib/audit/log";
import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import type { BrandDto, CompetitorDto } from "@/lib/brands/types";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";
import { assertWithinLimit } from "@/lib/usage/entitlements";
import { domainFromUrl, type BrandInput } from "@/lib/validation/brand";

type BrandWithCompetitors = Brand & { competitors: Competitor[] };

function toCompetitorDto(competitor: Competitor): CompetitorDto {
  return {
    id: competitor.id,
    name: competitor.name,
    websiteUrl: competitor.websiteUrl,
    domain: competitor.domain,
    status: competitor.status,
    source: competitor.source,
  };
}

function toBrandDto(brand: BrandWithCompetitors): BrandDto {
  return {
    id: brand.id,
    name: brand.name,
    websiteUrl: brand.websiteUrl,
    domain: brand.domain,
    description: brand.description,
    category: brand.category,
    services: brand.services,
    audiences: brand.audiences,
    painPoints: brand.painPoints,
    contentThemes: brand.contentThemes,
    differentiators: brand.differentiators,
    discoveryPageCount: brand.discoveryPageCount,
    status: brand.status,
    defaultMarketId: brand.defaultMarketId,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
    competitors: brand.competitors.map(toCompetitorDto),
  };
}

/** Only ACTIVE projects — the ones a user has finished onboarding for. */
export async function listBrands(ctx: WorkspaceContext): Promise<BrandDto[]> {
  const brands = await scopedDb(ctx).brand.findMany({
    where: { status: "ACTIVE" },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return brands.map(toBrandDto);
}

/** Only ACTIVE — a DRAFT project 404s here so the onboarding wizard is the only way to reach it. Use getBrandForReview() for that. */
export async function getBrand(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<BrandDto | null> {
  const brand = await scopedDb(ctx).brand.findFirst({
    where: { id: brandId, status: "ACTIVE" },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
  });

  return brand ? toBrandDto(brand) : null;
}

/** Unlike getBrand(), returns a project in any status — the onboarding wizard's review and market steps need to load a DRAFT. */
export async function getBrandForReview(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<BrandDto | null> {
  const brand = await scopedDb(ctx).brand.findFirst({
    where: { id: brandId },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
  });

  return brand ? toBrandDto(brand) : null;
}

/**
 * Created DRAFT with CANDIDATE competitors, not ACTIVE/ACCEPTED — discovery
 * is automated, so nothing here has been reviewed by a human yet. The
 * onboarding wizard's review step is what a user sees before
 * activateBrand() ever runs. The only caller today is the brandDiscovery
 * Inngest function.
 */
export async function createBrand(
  ctx: WorkspaceContext,
  input: BrandInput,
): Promise<BrandDto> {
  assertRole(ctx, "EDITOR");

  const currentBrandCount = await scopedDb(ctx).brand.count();
  await assertWithinLimit(ctx, "brands", currentBrandCount);

  const brand = await scopedDb(ctx).brand.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: input.name,
      websiteUrl: input.websiteUrl,
      domain: domainFromUrl(input.websiteUrl),
      description: input.description,
      category: input.category,
      services: input.services ?? [],
      audiences: input.audiences ?? [],
      painPoints: input.painPoints ?? [],
      contentThemes: input.contentThemes ?? [],
      differentiators: input.differentiators ?? [],
      discoveryPageCount: input.discoveryPageCount ?? 0,
      status: "DRAFT",
      competitors: {
        create: input.competitors.map((competitor) => ({
          name: competitor.name,
          websiteUrl: competitor.websiteUrl,
          domain: domainFromUrl(competitor.websiteUrl),
          workspaceId: ctx.workspaceId,
          source: "AI_DISCOVERED",
          status: "CANDIDATE",
        })),
      },
    },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
  });

  await recordAudit(ctx, {
    action: "brand.created",
    targetType: "Brand",
    targetId: brand.id,
  });

  return toBrandDto(brand);
}

/**
 * Competitors are upserted by domain rather than deleted and recreated, so a
 * competitor's id — and anything that will later reference it, starting with
 * Phase 3's ThreatScore — survives a re-analysis. Only domains no longer
 * present in `input` are deleted.
 */
export async function updateBrand(
  ctx: WorkspaceContext,
  brandId: string,
  input: BrandInput,
): Promise<BrandDto> {
  assertRole(ctx, "EDITOR");

  const existing = await scopedDb(ctx).brand.findFirst({
    where: { id: brandId },
    select: {
      id: true,
      competitors: { select: { id: true, domain: true } },
    },
  });

  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const incomingDomains = new Set(
    input.competitors.map((competitor) => domainFromUrl(competitor.websiteUrl)),
  );
  const toDelete = existing.competitors
    .filter((competitor) => !incomingDomains.has(competitor.domain))
    .map((competitor) => competitor.id);

  const brand = await scopedDb(ctx).brand.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      websiteUrl: input.websiteUrl,
      domain: domainFromUrl(input.websiteUrl),
      description: input.description,
      category: input.category,
      services: input.services,
      audiences: input.audiences,
      painPoints: input.painPoints,
      contentThemes: input.contentThemes,
      differentiators: input.differentiators,
      discoveryPageCount: input.discoveryPageCount,
      competitors: {
        deleteMany: toDelete.length > 0 ? { id: { in: toDelete } } : undefined,
        upsert: input.competitors.map((competitor) => {
          const domain = domainFromUrl(competitor.websiteUrl);
          return {
            where: { brandId_domain: { brandId: existing.id, domain } },
            update: {
              name: competitor.name,
              websiteUrl: competitor.websiteUrl,
            },
            create: {
              name: competitor.name,
              websiteUrl: competitor.websiteUrl,
              domain,
              workspaceId: ctx.workspaceId,
            },
          };
        }),
      },
    },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
  });

  await recordAudit(ctx, {
    action: "brand.updated",
    targetType: "Brand",
    targetId: brand.id,
  });

  return toBrandDto(brand);
}

/**
 * The onboarding review step's save: only the two AI-discovered text fields,
 * and only while the project is still a DRAFT. Editing an ACTIVE project's
 * profile goes through updateBrand() (full re-analysis) instead.
 */
export async function updateDraftProfile(
  ctx: WorkspaceContext,
  brandId: string,
  input: { description: string; category: string },
): Promise<BrandDto> {
  assertRole(ctx, "EDITOR");

  try {
    const brand = await scopedDb(ctx).brand.update({
      where: { id: brandId, status: "DRAFT" },
      data: { description: input.description, category: input.category },
      include: { competitors: { orderBy: { createdAt: "asc" } } },
    });
    return toBrandDto(brand);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(
        404,
        "BRAND_NOT_FOUND",
        "This project is not awaiting review.",
      );
    }
    throw error;
  }
}

/**
 * Attaches the chosen default market and timezone. Used both by the
 * onboarding market step (while the project is still a DRAFT) and by project
 * settings later (once it's ACTIVE), so this does not filter on status —
 * callers that need to restrict to one lifecycle stage do so themselves.
 */
export async function setBrandMarket(
  ctx: WorkspaceContext,
  brandId: string,
  input: { defaultMarketId: string; timezone: string },
): Promise<BrandDto> {
  assertRole(ctx, "EDITOR");

  try {
    const brand = await scopedDb(ctx).brand.update({
      where: { id: brandId },
      data: {
        defaultMarketId: input.defaultMarketId,
        timezone: input.timezone,
      },
      include: { competitors: { orderBy: { createdAt: "asc" } } },
    });
    return toBrandDto(brand);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
    }
    throw error;
  }
}

/** DRAFT → ACTIVE. The last step of onboarding — a project only appears in listBrands()/getBrand() after this runs. */
export async function activateBrand(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<BrandDto> {
  assertRole(ctx, "EDITOR");

  try {
    const brand = await scopedDb(ctx).brand.update({
      where: { id: brandId, status: "DRAFT" },
      data: { status: "ACTIVE" },
      include: { competitors: { orderBy: { createdAt: "asc" } } },
    });

    await recordAudit(ctx, {
      action: "brand.activated",
      targetType: "Brand",
      targetId: brand.id,
    });

    return toBrandDto(brand);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(
        404,
        "BRAND_NOT_FOUND",
        "This project is not awaiting review.",
      );
    }
    throw error;
  }
}

export async function deleteBrand(
  ctx: WorkspaceContext,
  brandId: string,
  confirmation: string,
) {
  // Higher bar than create/update: deleting a project is destructive and
  // cascades every Phase-2+ observation attached to it.
  assertRole(ctx, "ADMIN");

  const existing = await scopedDb(ctx).brand.findFirst({
    where: { id: brandId },
    select: { id: true, name: true },
  });

  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  if (confirmation !== existing.name) {
    throw new AppError(
      400,
      "CONFIRMATION_MISMATCH",
      "Enter the exact project name to confirm deletion.",
      { confirmation: ["The project name does not match"] },
    );
  }

  await scopedDb(ctx).brand.delete({ where: { id: existing.id } });

  await recordAudit(ctx, {
    action: "brand.deleted",
    targetType: "Brand",
    targetId: existing.id,
    metadata: { name: existing.name },
  });

  const nextBrand = await scopedDb(ctx).brand.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  return { deletedId: existing.id, nextBrandId: nextBrand?.id ?? null };
}
