import { NextResponse } from "next/server";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getOperation } from "@/lib/operations/service";
import type { OperationDto } from "@/lib/operations/types";

type RouteParams = { operationId: string };

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const operation = await getOperation(ctx, params.operationId);
  if (!operation) {
    throw new AppError(404, "OPERATION_NOT_FOUND", "Operation not found.");
  }
  return NextResponse.json({
    data: operation,
  } satisfies ApiSuccess<OperationDto>);
});
