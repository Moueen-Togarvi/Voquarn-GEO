import { NextResponse } from "next/server";

import type { ApiAccepted } from "@/lib/api/types";
import { getClientIp } from "@/lib/api/client-ip";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getBrandForReview } from "@/lib/brands/service";
import { inngest } from "@/lib/inngest/client";
import { promptsGenerationRequested } from "@/lib/inngest/events";
import { createOperation } from "@/lib/operations/service";

type RouteParams = { brandId: string };

export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const rateLimit = await checkRateLimit({
    key: `prompt-generation:${getClientIp(request)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many requests recently. Try again in a bit.",
    );
  }

  const existing = await getBrandForReview(ctx, params.brandId);
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

  const operation = await createOperation(ctx, {
    kind: "PROMPT_GENERATION",
    brandId: existing.id,
    progressTotal: 3,
  });

  await inngest.send(
    promptsGenerationRequested.create({
      workspaceId: ctx.workspaceId,
      brandId: existing.id,
      operationId: operation.id,
    }),
  );

  return NextResponse.json(
    { operationId: operation.id } satisfies ApiAccepted,
    { status: 202 },
  );
});
