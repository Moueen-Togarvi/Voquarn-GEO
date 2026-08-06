import { NextResponse } from "next/server";

import type { ApiSuccess } from "@/lib/api/types";
import { route } from "@/lib/api/handler";
import { removePlanItem } from "@/lib/opportunity/service";

type RouteParams = { planItemId: string };

export const DELETE = route<RouteParams>(async ({ ctx, params }) => {
  await removePlanItem(ctx, params.planItemId);
  return NextResponse.json({
    data: { deletedId: params.planItemId },
  } satisfies ApiSuccess<{ deletedId: string }>);
});
