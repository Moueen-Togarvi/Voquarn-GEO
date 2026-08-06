import { NextResponse } from "next/server";

import type { ApiAccepted } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { assertRole } from "@/lib/auth/context";
import { getContentItem } from "@/lib/content/service";
import { inngest } from "@/lib/inngest/client";
import { contentDraftRequested } from "@/lib/inngest/events";
import { createOperation, failOperation } from "@/lib/operations/service";

type RouteParams = { contentItemId: string };

const DRAFTABLE_STATES = new Set(["BRIEF_READY", "CHANGES_REQUESTED"]);

export const POST = route<RouteParams>(async ({ ctx, params }) => {
  const item = await getContentItem(ctx, params.contentItemId);
  if (!item) {
    throw new AppError(
      404,
      "CONTENT_ITEM_NOT_FOUND",
      "Content item not found.",
    );
  }
  if (!DRAFTABLE_STATES.has(item.state)) {
    throw new AppError(
      409,
      "VALIDATION_ERROR",
      `Cannot draft from state ${item.state}. A brief must be ready, or changes must have been requested, first.`,
    );
  }

  assertRole(ctx, "EDITOR");

  const operation = await createOperation(ctx, {
    kind: "CONTENT_DRAFT",
    brandId: item.brandId,
  });

  try {
    await inngest.send(
      contentDraftRequested.create({
        workspaceId: ctx.workspaceId,
        contentItemId: item.id,
        operationId: operation.id,
      }),
    );
  } catch (error) {
    await failOperation(ctx, operation.id, {
      errorCode: "INTERNAL_ERROR",
      errorMessage:
        error instanceof Error ? error.message : "Could not start drafting.",
    });
    throw error;
  }

  return NextResponse.json(
    { operationId: operation.id } satisfies ApiAccepted,
    { status: 202 },
  );
});
