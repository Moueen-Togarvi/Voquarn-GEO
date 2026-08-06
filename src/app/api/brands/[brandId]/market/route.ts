import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getBrand, setBrandMarket } from "@/lib/brands/service";
import type { BrandDto } from "@/lib/brands/types";
import { findOrCreateMarket } from "@/lib/markets/service";

type RouteParams = { brandId: string };

const marketUpdateSchema = z.object({
  country: z.string().trim().length(2).toUpperCase(),
  region: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  language: z.string().trim().min(2).max(10).toLowerCase(),
  device: z.enum(["DESKTOP", "MOBILE"]).optional(),
  timezone: z.string().trim().min(1),
});

export const PATCH = route<RouteParams>(async ({ ctx, request, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const input = marketUpdateSchema.parse(await request.json());

  const market = await findOrCreateMarket(ctx, {
    country: input.country,
    region: input.region ?? null,
    city: input.city ?? null,
    language: input.language,
    device: input.device,
    timezone: input.timezone,
  });

  const brand = await setBrandMarket(ctx, existing.id, {
    defaultMarketId: market.id,
    timezone: input.timezone,
  });

  return NextResponse.json({ data: brand } satisfies ApiSuccess<BrandDto>);
});
