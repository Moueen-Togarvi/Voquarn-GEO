import type { Site } from "@/generated/prisma/client";
import type { SiteVerificationMethod } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

export type SiteDto = {
  id: string;
  domain: string;
  verified: boolean;
  verificationMethod: SiteVerificationMethod | null;
  gscSiteUrl: string | null;
  brandId: string;
};

function toDto(site: Site): SiteDto {
  return {
    id: site.id,
    domain: site.domain,
    verified: site.verified,
    verificationMethod: site.verificationMethod,
    gscSiteUrl: site.gscSiteUrl,
    brandId: site.brandId,
  };
}

/**
 * A full site-verification flow (DNS TXT / HTML file upload) is future
 * work — see SiteVerificationMethod in schema.prisma. For now, every brand
 * gets exactly one Site auto-provisioned from its own (already-collected)
 * domain the first time something needs one, e.g. connecting Search
 * Console — see markSiteVerifiedViaGsc() below for how GSC_OAUTH becomes a
 * legitimate verification method in its own right.
 */
export async function getOrCreateSiteForBrand(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<SiteDto> {
  const existing = await scopedDb(ctx).site.findFirst({ where: { brandId } });
  if (existing) return toDto(existing);

  const brand = await scopedDb(ctx).brand.findFirstOrThrow({
    where: { id: brandId },
    select: { domain: true },
  });

  const created = await scopedDb(ctx).site.create({
    data: { workspaceId: ctx.workspaceId, brandId, domain: brand.domain },
  });

  return toDto(created);
}

export async function getSite(
  ctx: WorkspaceContext,
  siteId: string,
): Promise<SiteDto | null> {
  const site = await scopedDb(ctx).site.findFirst({ where: { id: siteId } });
  return site ? toDto(site) : null;
}

/**
 * Successfully completing Google's OAuth consent for a specific GSC
 * property is itself evidence of ownership/access — as legitimate a
 * verification method as the DNS TXT / HTML file options, and the only one
 * actually wired up yet.
 */
export async function markSiteVerifiedViaGsc(
  ctx: WorkspaceContext,
  siteId: string,
  gscSiteUrl: string,
): Promise<void> {
  await scopedDb(ctx).site.update({
    where: { id: siteId },
    data: { verified: true, verificationMethod: "GSC_OAUTH", gscSiteUrl },
  });
}
