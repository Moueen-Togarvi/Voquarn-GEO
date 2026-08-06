import { NextResponse } from "next/server";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getContentItem } from "@/lib/content/service";
import type { ContentItemDetailDto } from "@/lib/content/types";

type RouteParams = { contentItemId: string };

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const item = await getContentItem(ctx, params.contentItemId);
  if (!item) {
    throw new AppError(
      404,
      "CONTENT_ITEM_NOT_FOUND",
      "Content item not found.",
    );
  }
  return NextResponse.json({
    data: item,
  } satisfies ApiSuccess<ContentItemDetailDto>);
});
