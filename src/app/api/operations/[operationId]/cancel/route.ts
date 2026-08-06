import { NextResponse } from "next/server";

import type { ApiSuccess } from "@/lib/api/types";
import { route } from "@/lib/api/handler";
import { cancelOperation } from "@/lib/operations/service";
import type { OperationDto } from "@/lib/operations/types";

type RouteParams = { operationId: string };

export const POST = route<RouteParams>(async ({ ctx, params }) => {
  const operation = await cancelOperation(ctx, params.operationId);
  return NextResponse.json({
    data: operation,
  } satisfies ApiSuccess<OperationDto>);
});
