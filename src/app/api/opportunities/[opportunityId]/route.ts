import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import {
  getOpportunity,
  recordOpportunityDecision,
} from "@/lib/opportunity/service";
import type {
  OpportunityDetailDto,
  OpportunityDto,
} from "@/lib/opportunity/types";

type RouteParams = { opportunityId: string };

const decisionSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "DEFERRED",
    "DISMISSED",
    "IN_PROGRESS",
    "COMPLETED",
  ]),
  reason: z.string().trim().max(500).optional(),
});

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const opportunity = await getOpportunity(ctx, params.opportunityId);
  if (!opportunity) {
    throw new AppError(404, "OPPORTUNITY_NOT_FOUND", "Opportunity not found.");
  }
  return NextResponse.json({
    data: opportunity,
  } satisfies ApiSuccess<OpportunityDetailDto>);
});

export const PATCH = route<RouteParams>(async ({ ctx, request, params }) => {
  const input = decisionSchema.parse(await request.json());
  const opportunity = await recordOpportunityDecision(
    ctx,
    params.opportunityId,
    {
      status: input.status,
      reason: input.reason,
      actorId: ctx.userId ?? undefined,
    },
  );
  return NextResponse.json({
    data: opportunity,
  } satisfies ApiSuccess<OpportunityDto>);
});
