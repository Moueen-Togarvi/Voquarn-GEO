import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { route } from "@/lib/api/handler";
import type { CompetitorDto } from "@/lib/brands/types";
import { updateCompetitorStatus } from "@/lib/competitors/service";

type RouteParams = { competitorId: string };

const updateSchema = z.object({
  status: z.enum(["CANDIDATE", "ACCEPTED", "IGNORED", "PINNED"]),
});

export const PATCH = route<RouteParams>(async ({ ctx, request, params }) => {
  const { status } = updateSchema.parse(await request.json());
  const competitor = await updateCompetitorStatus(
    ctx,
    params.competitorId,
    status,
  );
  return NextResponse.json({
    data: competitor,
  } satisfies ApiSuccess<CompetitorDto>);
});
