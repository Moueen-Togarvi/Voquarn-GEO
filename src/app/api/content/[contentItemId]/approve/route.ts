import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getContentItem, recordApproval } from "@/lib/content/service";
import type { ApprovalDto } from "@/lib/content/types";

type RouteParams = { contentItemId: string };

const approveSchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  comment: z.string().trim().max(1000).optional(),
});

export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const item = await getContentItem(ctx, params.contentItemId);
  if (!item) {
    throw new AppError(
      404,
      "CONTENT_ITEM_NOT_FOUND",
      "Content item not found.",
    );
  }
  if (!item.latestVersion) {
    throw new AppError(
      409,
      "VALIDATION_ERROR",
      "There is no draft yet to approve or request changes on.",
    );
  }

  const input = approveSchema.parse(await request.json());
  const approval = await recordApproval(ctx, {
    versionId: item.latestVersion.id,
    contentItemId: item.id,
    decision: input.decision,
    comment: input.comment,
    actorId: ctx.userId ?? undefined,
  });

  return NextResponse.json({
    data: approval,
  } satisfies ApiSuccess<ApprovalDto>);
});
