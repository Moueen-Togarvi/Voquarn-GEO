import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiAccepted, ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { assertRole } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { inngest } from "@/lib/inngest/client";
import { opportunityDetectRequested } from "@/lib/inngest/events";
import { createOperation, failOperation } from "@/lib/operations/service";
import { listOpportunities } from "@/lib/opportunity/service";
import type { OpportunityDto } from "@/lib/opportunity/types";

type RouteParams = { brandId: string };

const listQuerySchema = z.object({
  status: z
    .enum([
      "NEW",
      "ACCEPTED",
      "DEFERRED",
      "DISMISSED",
      "IN_PROGRESS",
      "COMPLETED",
    ])
    .optional(),
});

export const GET = route<RouteParams>(async ({ ctx, request, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const { status } = listQuerySchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  const opportunities = await listOpportunities(ctx, {
    brandId: existing.id,
    status,
  });
  return NextResponse.json({
    data: opportunities,
  } satisfies ApiSuccess<OpportunityDto[]>);
});

export const POST = route<RouteParams>(async ({ ctx, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  assertRole(ctx, "EDITOR");

  const operation = await createOperation(ctx, {
    kind: "OPPORTUNITY_DETECT",
    brandId: existing.id,
  });

  try {
    await inngest.send(
      opportunityDetectRequested.create({
        workspaceId: ctx.workspaceId,
        brandId: existing.id,
        operationId: operation.id,
      }),
    );
  } catch (error) {
    await failOperation(ctx, operation.id, {
      errorCode: "INTERNAL_ERROR",
      errorMessage:
        error instanceof Error ? error.message : "Could not start detection.",
    });
    throw error;
  }

  return NextResponse.json(
    { operationId: operation.id } satisfies ApiAccepted,
    { status: 202 },
  );
});
