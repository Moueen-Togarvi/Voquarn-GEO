import { NextResponse } from "next/server";

import type { ApiAccepted } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { assertRole } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { inngest } from "@/lib/inngest/client";
import { competitorExpansionRequested } from "@/lib/inngest/events";
import { createOperation } from "@/lib/operations/service";

type RouteParams = { brandId: string };

/** Manual "Find more competitors" trigger — the automatic counterpart fires from src/lib/inngest/functions/brand-discovery.ts right after every discovery/re-analysis. */
export const POST = route<RouteParams>(async ({ ctx, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  assertRole(ctx, "EDITOR");

  const operation = await createOperation(ctx, {
    kind: "COMPETITOR_EXPANSION",
    brandId: existing.id,
    progressTotal: 3,
  });

  await inngest.send(
    competitorExpansionRequested.create({
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
