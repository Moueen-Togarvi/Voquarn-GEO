import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getBrand } from "@/lib/brands/service";
import {
  bulkAddKeywords,
  listProjectKeywords,
  type ProjectKeywordDto,
} from "@/lib/keywords/service";

type RouteParams = { brandId: string };

const bulkAddSchema = z.object({
  marketId: z.string().min(1),
  keywords: z.array(z.string().trim().min(1)).min(1).max(500),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const keywords = await listProjectKeywords(ctx, existing.id);
  return NextResponse.json({
    data: keywords,
  } satisfies ApiSuccess<ProjectKeywordDto[]>);
});

export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const input = bulkAddSchema.parse(await request.json());

  const result = await bulkAddKeywords(ctx, {
    brandId: existing.id,
    marketId: input.marketId,
    keywords: input.keywords,
    priority: input.priority,
  });

  return NextResponse.json({
    data: result,
  } satisfies ApiSuccess<{ linkedCount: number }>);
});
