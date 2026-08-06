import { NextResponse } from "next/server";

import type { ApiAccepted } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { assertRole } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { createCrawlRun } from "@/lib/crawl/service";
import { inngest } from "@/lib/inngest/client";
import { crawlRunRequested } from "@/lib/inngest/events";
import { createOperation, failOperation } from "@/lib/operations/service";

type RouteParams = { brandId: string };

export const POST = route<RouteParams>(async ({ ctx, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  assertRole(ctx, "EDITOR");

  const operation = await createOperation(ctx, {
    kind: "CRAWL",
    brandId: existing.id,
  });

  let crawlRunId: string;
  try {
    const crawlRun = await createCrawlRun(ctx, {
      host: existing.domain,
      brandId: existing.id,
      operationId: operation.id,
    });
    crawlRunId = crawlRun.id;
  } catch (error) {
    await failOperation(ctx, operation.id, {
      errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      errorMessage:
        error instanceof Error ? error.message : "Crawl creation failed.",
    });
    throw error;
  }

  await inngest.send(
    crawlRunRequested.create({
      workspaceId: ctx.workspaceId,
      crawlRunId,
      host: existing.domain,
    }),
  );

  return NextResponse.json(
    { operationId: operation.id } satisfies ApiAccepted,
    { status: 202 },
  );
});
