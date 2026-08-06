import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { route } from "@/lib/api/handler";
import { createRevisionVersion } from "@/lib/content/service";
import type { ContentVersionDto } from "@/lib/content/types";

type RouteParams = { contentItemId: string };

const createRevisionSchema = z.object({
  doc: z.object({ type: z.literal("doc"), content: z.array(z.any()) }),
});

/** A human editing directly in the editor after the current version was approved — the only other path to a new version besides the LLM draft pipeline. See the ContentVersion model comment on immutability. */
export const POST = route<RouteParams>(async ({ ctx, request, params }) => {
  const input = createRevisionSchema.parse(await request.json());
  const version = await createRevisionVersion(ctx, {
    contentItemId: params.contentItemId,
    doc: input.doc,
    createdBy: ctx.userId ?? undefined,
  });
  return NextResponse.json(
    { data: version } satisfies ApiSuccess<ContentVersionDto>,
    { status: 201 },
  );
});
