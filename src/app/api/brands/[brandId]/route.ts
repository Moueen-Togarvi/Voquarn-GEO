import { NextResponse } from "next/server";

import type { ApiAccepted, ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { deleteBrand, getBrand } from "@/lib/brands/service";
import type { BrandDto } from "@/lib/brands/types";
import {
  assertPublicWebsiteUrl,
  UnsafeWebsiteError,
} from "@/lib/discovery/website";
import { inngest } from "@/lib/inngest/client";
import { brandDiscoveryRequested } from "@/lib/inngest/events";
import { createOperation } from "@/lib/operations/service";
import {
  brandDiscoveryInputSchema,
  deleteBrandSchema,
} from "@/lib/validation/brand";

type RouteParams = { brandId: string };

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const brand = await getBrand(ctx, params.brandId);
  if (!brand) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }
  return NextResponse.json({ data: brand } satisfies ApiSuccess<BrandDto>);
});

export const PATCH = route<RouteParams>(async ({ ctx, request, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const input = brandDiscoveryInputSchema.parse(await request.json());

  try {
    await assertPublicWebsiteUrl(input.websiteUrl);
  } catch (error) {
    if (error instanceof UnsafeWebsiteError) {
      throw new AppError(400, "UNSAFE_WEBSITE_URL", error.message, {
        websiteUrl: [error.message],
      });
    }
    throw error;
  }

  const operation = await createOperation(ctx, {
    kind: "BRAND_DISCOVERY",
    brandId: existing.id,
    progressTotal: 4,
  });

  await inngest.send(
    brandDiscoveryRequested.create({
      workspaceId: ctx.workspaceId,
      operationId: operation.id,
      brandId: existing.id,
      name: input.name,
      websiteUrl: input.websiteUrl,
    }),
  );

  return NextResponse.json(
    { operationId: operation.id } satisfies ApiAccepted,
    { status: 202 },
  );
});

export const DELETE = route<RouteParams>(async ({ ctx, request, params }) => {
  const { confirmation } = deleteBrandSchema.parse(await request.json());
  return NextResponse.json({
    data: await deleteBrand(ctx, params.brandId, confirmation),
  } satisfies ApiSuccess<{ deletedId: string; nextBrandId: string | null }>);
});
