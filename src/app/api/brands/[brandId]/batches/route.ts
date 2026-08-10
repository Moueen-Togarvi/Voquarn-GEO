import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiAccepted, ApiSuccess } from "@/lib/api/types";
import { getClientIp } from "@/lib/api/client-ip";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getBrand } from "@/lib/brands/service";
import { createBatch, listBatches } from "@/lib/benchmark/service";
import type { AnalysisBatchDto } from "@/lib/benchmark/types";
import { inngest } from "@/lib/inngest/client";
import { benchmarkBatchRequested } from "@/lib/inngest/events";
import { createOperation, failOperation } from "@/lib/operations/service";

type RouteParams = { brandId: string };

const createBatchSchema = z.object({
  marketId: z.string().optional(),
  repetitions: z.number().int().min(1).max(5).default(1),
});

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const batches = await listBatches(ctx, existing.id);
  return NextResponse.json({
    data: batches,
  } satisfies ApiSuccess<AnalysisBatchDto[]>);
});

export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const rateLimit = await checkRateLimit({
    key: `benchmark-batch:${getClientIp(request)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      "Too many analysis runs recently. Try again in a bit.",
    );
  }

  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const input = createBatchSchema.parse(await request.json().catch(() => ({})));
  const marketId = input.marketId ?? existing.defaultMarketId;
  if (!marketId) {
    throw new AppError(
      400,
      "MARKET_NOT_FOUND",
      "This project has no market configured yet.",
    );
  }

  const operation = await createOperation(ctx, {
    kind: "BENCHMARK_BATCH",
    brandId: existing.id,
  });

  // createBatch validates (active prompts exist, within quota) after the
  // Operation row already exists — on failure, resolve it to FAILED rather
  // than leaving it stuck PENDING forever, then re-throw so the route still
  // reports the real error to the caller.
  let batch;
  try {
    ({ batch } = await createBatch(ctx, {
      brandId: existing.id,
      marketId,
      operationId: operation.id,
      repetitions: input.repetitions,
    }));
  } catch (error) {
    await failOperation(ctx, operation.id, {
      errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      errorMessage:
        error instanceof Error ? error.message : "Batch creation failed.",
    });
    throw error;
  }

  await inngest.send(
    benchmarkBatchRequested.create({
      workspaceId: ctx.workspaceId,
      brandId: existing.id,
      batchId: batch.id,
      marketId,
      repetitions: input.repetitions,
    }),
  );

  return NextResponse.json(
    { operationId: operation.id } satisfies ApiAccepted,
    { status: 202 },
  );
});
