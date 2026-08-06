import { NextResponse } from "next/server";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getBatch } from "@/lib/benchmark/service";
import type { BatchDetailDto } from "@/lib/benchmark/types";

type RouteParams = { batchId: string };

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const batch = await getBatch(ctx, params.batchId);
  if (!batch) {
    throw new AppError(404, "BATCH_NOT_FOUND", "Batch not found.");
  }
  return NextResponse.json({
    data: batch,
  } satisfies ApiSuccess<BatchDetailDto>);
});
