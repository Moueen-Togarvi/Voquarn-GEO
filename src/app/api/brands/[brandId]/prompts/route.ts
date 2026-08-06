import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getBrand } from "@/lib/brands/service";
import { createPrompt, listPrompts } from "@/lib/prompts/service";
import type { PromptDto } from "@/lib/prompts/types";

type RouteParams = { brandId: string };

const createPromptSchema = z.object({
  text: z.string().trim().min(10).max(300),
  type: z.enum(["CATEGORY", "COMPARISON", "USE_CASE", "BRAND_SPECIFIC"]),
});

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const prompts = await listPrompts(ctx, existing.id);
  return NextResponse.json({ data: prompts } satisfies ApiSuccess<PromptDto[]>);
});

export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }
  if (!existing.defaultMarketId) {
    throw new AppError(
      400,
      "MARKET_NOT_FOUND",
      "This project has no market configured yet.",
    );
  }

  const input = createPromptSchema.parse(await request.json());
  const prompt = await createPrompt(ctx, {
    brandId: existing.id,
    marketId: existing.defaultMarketId,
    text: input.text,
    type: input.type,
  });

  return NextResponse.json({ data: prompt } satisfies ApiSuccess<PromptDto>, {
    status: 201,
  });
});
