import { NextResponse } from "next/server";

import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { createOrReplaceConnection } from "@/lib/integrations/service";
import { findMatchingGscSite, listGscSites } from "@/lib/providers/gsc/client";
import { exchangeCodeForTokens, verifyState } from "@/lib/providers/gsc/oauth";
import { getSite, markSiteVerifiedViaGsc } from "@/lib/sites/service";

export const GET = route(async ({ ctx, request }) => {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (!stateParam) {
    throw new AppError(400, "VALIDATION_ERROR", "Missing OAuth state.");
  }

  const { siteId } = verifyState(stateParam);
  const site = await getSite(ctx, siteId);
  if (!site) {
    throw new AppError(404, "SITE_NOT_FOUND", "Site not found.");
  }

  const brandId = site.brandId;
  function redirectTo(status: "connected" | "error", message?: string) {
    const url = new URL(`/projects/${brandId}/settings`, request.url);
    url.searchParams.set("gsc", status);
    if (message) url.searchParams.set("gscMessage", message);
    return NextResponse.redirect(url);
  }

  if (oauthError) {
    return redirectTo("error", oauthError);
  }
  if (!code) {
    return redirectTo("error", "missing_code");
  }

  try {
    const redirectUri = new URL(
      "/api/integrations/google-search-console/callback",
      request.url,
    ).toString();
    const tokens = await exchangeCodeForTokens({ code, redirectUri });

    if (!tokens.refresh_token) {
      return redirectTo("error", "no_refresh_token");
    }

    const gscSites = await listGscSites(tokens.access_token);
    const matched = findMatchingGscSite(gscSites, site.domain);
    if (!matched) {
      return redirectTo("error", "no_matching_property");
    }

    await createOrReplaceConnection(ctx, {
      siteId: site.id,
      provider: "GOOGLE_SEARCH_CONSOLE",
      externalAccountId: matched.siteUrl,
      scopes: tokens.scope.split(" "),
      refreshToken: tokens.refresh_token,
    });
    await markSiteVerifiedViaGsc(ctx, site.id, matched.siteUrl);

    return redirectTo("connected");
  } catch (error) {
    return redirectTo(
      "error",
      error instanceof Error ? error.message : "unknown_error",
    );
  }
});
