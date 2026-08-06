import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getBrand } from "@/lib/brands/service";
import { addApprovedVoiceSample } from "@/lib/brands/voice";
import type { BrandVoiceProfileDto } from "@/lib/brands/voice";

type RouteParams = { brandId: string };

const addSampleSchema = z.object({
  text: z.string().trim().min(20).max(2000),
});

export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const input = addSampleSchema.parse(await request.json());
  const profile = await addApprovedVoiceSample(ctx, existing.id, input.text);

  return NextResponse.json({
    data: profile,
  } satisfies ApiSuccess<BrandVoiceProfileDto>);
});
