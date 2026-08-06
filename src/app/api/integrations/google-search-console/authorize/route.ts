import { NextResponse } from "next/server";

import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { assertRole } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { buildAuthorizationUrl, signState } from "@/lib/providers/gsc/oauth";
import { getOrCreateSiteForBrand } from "@/lib/sites/service";

export const GET = route(async ({ ctx, request }) => {
  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) {
    throw new AppError(400, "VALIDATION_ERROR", "brandId is required.");
  }

  const brand = await getBrand(ctx, brandId);
  if (!brand) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  assertRole(ctx, "EDITOR");

  const site = await getOrCreateSiteForBrand(ctx, brand.id);
  const state = signState({ workspaceId: ctx.workspaceId, siteId: site.id });
  const redirectUri = new URL(
    "/api/integrations/google-search-console/callback",
    request.url,
  ).toString();

  return NextResponse.redirect(buildAuthorizationUrl({ redirectUri, state }));
});
