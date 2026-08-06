import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiAccepted, ApiSuccess } from "@/lib/api/types";
import { AppError } from "@/lib/api/errors";
import { route } from "@/lib/api/handler";
import { getBrand } from "@/lib/brands/service";
import { createContentItem, listContentItems } from "@/lib/content/service";
import type { ContentItemDto } from "@/lib/content/types";
import { inngest } from "@/lib/inngest/client";
import { contentBriefRequested } from "@/lib/inngest/events";
import { createOperation, failOperation } from "@/lib/operations/service";

type RouteParams = { brandId: string };

const createContentItemSchema = z.object({
  title: z.string().trim().min(3).max(200),
  opportunityId: z.string().optional(),
  targetWordCount: z.number().int().min(100).max(20000).optional(),
});

export const GET = route<RouteParams>(async ({ ctx, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const items = await listContentItems(ctx, existing.id);
  return NextResponse.json({ data: items } satisfies ApiSuccess<
    ContentItemDto[]
  >);
});

export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const existing = await getBrand(ctx, params.brandId);
  if (!existing) {
    throw new AppError(404, "BRAND_NOT_FOUND", "Project not found.");
  }

  const input = createContentItemSchema.parse(await request.json());

  const item = await createContentItem(ctx, {
    brandId: existing.id,
    title: input.title,
    opportunityId: input.opportunityId,
    targetWordCount: input.targetWordCount,
  });

  const operation = await createOperation(ctx, {
    kind: "CONTENT_BRIEF",
    brandId: existing.id,
  });

  try {
    await inngest.send(
      contentBriefRequested.create({
        workspaceId: ctx.workspaceId,
        contentItemId: item.id,
        operationId: operation.id,
      }),
    );
  } catch (error) {
    await failOperation(ctx, operation.id, {
      errorCode: "INTERNAL_ERROR",
      errorMessage:
        error instanceof Error ? error.message : "Could not start research.",
    });
    throw error;
  }

  return NextResponse.json(
    {
      operationId: operation.id,
      contentItemId: item.id,
    } satisfies ApiAccepted & {
      contentItemId: string;
    },
    { status: 202 },
  );
});
