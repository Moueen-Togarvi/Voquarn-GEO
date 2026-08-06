import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { route } from "@/lib/api/handler";
import { updateDraftContent } from "@/lib/content/service";
import type { ContentVersionDto } from "@/lib/content/types";

type RouteParams = { contentItemId: string; versionId: string };

// A ProseMirror node is recursive and not worth fully typing at the
// request-validation boundary — z.any() here, with the real shape enforced
// by src/lib/content/prosemirror.ts's readers, which only ever look at the
// small subset of node types (heading/paragraph/list/text) they understand.
const autosaveSchema = z.object({
  doc: z.object({ type: z.literal("doc"), content: z.array(z.any()) }),
});

/** Autosave — a debounced PATCH from the editor. Rejects with 409 if this version is already approved (see updateDraftContent's comment); the editor UI is expected to switch to creating a revision at that point. */
export const PATCH = route<RouteParams>(async ({ ctx, request, params }) => {
  const input = autosaveSchema.parse(await request.json());
  const version = await updateDraftContent(ctx, {
    versionId: params.versionId,
    doc: input.doc,
  });
  return NextResponse.json({
    data: version,
  } satisfies ApiSuccess<ContentVersionDto>);
});
