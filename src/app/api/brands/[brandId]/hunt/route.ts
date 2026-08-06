import { NextResponse } from "next/server";

import type { ApiAccepted } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { assertRole } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { inngest } from "@/lib/inngest/client";
import { huntSerpRequested } from "@/lib/inngest/events";
import { createOperation } from "@/lib/operations/service";

type RouteParams = { brandId: string };

export const POST = route<RouteParams>(async ({ ctx, params }) => {
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

  assertRole(ctx, "EDITOR");

  const operation = await createOperation(ctx, {
    kind: "SERP_HUNT",
    brandId: existing.id,
  });

  await inngest.send(
    huntSerpRequested.create({
      workspaceId: ctx.workspaceId,
      brandId: existing.id,
      marketId: existing.defaultMarketId,
      operationId: operation.id,
    }),
  );

  return NextResponse.json(
    { operationId: operation.id } satisfies ApiAccepted,
    { status: 202 },
  );
});
