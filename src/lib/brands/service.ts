import type { Brand, Competitor } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import type { BrandDto } from "@/lib/brands/types";
import { db } from "@/lib/db";
import { domainFromUrl, type BrandInput } from "@/lib/validation/brand";

const DEFAULT_WORKSPACE = {
  slug: "default",
  name: "Voquarn Workspace",
};

type BrandWithCompetitors = Brand & { competitors: Competitor[] };

function toBrandDto(brand: BrandWithCompetitors): BrandDto {
  return {
    id: brand.id,
    name: brand.name,
    websiteUrl: brand.websiteUrl,
    domain: brand.domain,
    description: brand.description,
    category: brand.category,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: brand.updatedAt.toISOString(),
    competitors: brand.competitors.map((competitor: Competitor) => ({
      id: competitor.id,
      name: competitor.name,
      websiteUrl: competitor.websiteUrl,
      domain: competitor.domain,
    })),
  };
}

export async function ensureDefaultWorkspace() {
  return db.workspace.upsert({
    where: { slug: DEFAULT_WORKSPACE.slug },
    update: {},
    create: DEFAULT_WORKSPACE,
  });
}

export async function listBrands(): Promise<BrandDto[]> {
  const workspace = await ensureDefaultWorkspace();
  const brands = await db.brand.findMany({
    where: { workspaceId: workspace.id },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return brands.map(toBrandDto);
}

export async function getBrand(brandId: string): Promise<BrandDto | null> {
  const workspace = await ensureDefaultWorkspace();
  const brand = await db.brand.findFirst({
    where: { id: brandId, workspaceId: workspace.id },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
  });

  return brand ? toBrandDto(brand) : null;
}

export async function createBrand(input: BrandInput): Promise<BrandDto> {
  const workspace = await ensureDefaultWorkspace();
  const brand = await db.brand.create({
    data: {
      workspaceId: workspace.id,
      name: input.name,
      websiteUrl: input.websiteUrl,
      domain: domainFromUrl(input.websiteUrl),
      description: input.description,
      category: input.category,
      competitors: {
        create: input.competitors.map((competitor) => ({
          name: competitor.name,
          websiteUrl: competitor.websiteUrl,
          domain: domainFromUrl(competitor.websiteUrl),
        })),
      },
    },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
  });

  return toBrandDto(brand);
}

export async function updateBrand(
  brandId: string,
  input: BrandInput,
): Promise<BrandDto> {
  const workspace = await ensureDefaultWorkspace();
  const existing = await db.brand.findFirst({
    where: { id: brandId, workspaceId: workspace.id },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const brand = await db.brand.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      websiteUrl: input.websiteUrl,
      domain: domainFromUrl(input.websiteUrl),
      description: input.description,
      category: input.category,
      competitors: {
        deleteMany: {},
        create: input.competitors.map((competitor) => ({
          name: competitor.name,
          websiteUrl: competitor.websiteUrl,
          domain: domainFromUrl(competitor.websiteUrl),
        })),
      },
    },
    include: { competitors: { orderBy: { createdAt: "asc" } } },
  });

  return toBrandDto(brand);
}

export async function deleteBrand(brandId: string, confirmation: string) {
  const workspace = await ensureDefaultWorkspace();
  const existing = await db.brand.findFirst({
    where: { id: brandId, workspaceId: workspace.id },
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

  await db.brand.delete({ where: { id: existing.id } });
  const nextBrand = await db.brand.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  return { deletedId: existing.id, nextBrandId: nextBrand?.id ?? null };
}
