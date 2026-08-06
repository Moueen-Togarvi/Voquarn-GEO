import { NextResponse } from "next/server";

import type { ApiSuccess } from "@/lib/api/types";
import { route } from "@/lib/api/handler";
import { disconnectIntegration } from "@/lib/integrations/service";

type RouteParams = { connectionId: string };

export const DELETE = route<RouteParams>(async ({ ctx, params }) => {
  await disconnectIntegration(ctx, params.connectionId);
  return NextResponse.json({
    data: { disconnected: true },
  } satisfies ApiSuccess<{ disconnected: boolean }>);
});
