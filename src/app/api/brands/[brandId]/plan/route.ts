import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getBrand } from "@/lib/brands/service";
import { addPlanItem, listCurrentPlanItems } from "@/lib/opportunity/service";
import type { ConquestPlanDto, PlanItemDto } from "@/lib/opportunity/types";

type RouteParams = { brandId: string };

const addPlanItemSchema = z.object({
  opportunityId: z.string(),
  ownerId: z.string().trim().max(120).optional(),
  dueAt: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const result = await listCurrentPlanItems(ctx, existing.id);
  return NextResponse.json({
    data: result,
  } satisfies ApiSuccess<{ plan: ConquestPlanDto; items: PlanItemDto[] }>);
});

export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const input = addPlanItemSchema.parse(await request.json());
  const item = await addPlanItem(ctx, {
    brandId: existing.id,
    opportunityId: input.opportunityId,
    ownerId: input.ownerId,
    dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
    notes: input.notes,
  });

  return NextResponse.json({ data: item } satisfies ApiSuccess<PlanItemDto>, {
    status: 201,
  });
});
