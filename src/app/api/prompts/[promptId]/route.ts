import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiSuccess } from "@/lib/api/types";
import { route } from "@/lib/api/handler";
import { deletePrompt, updatePrompt } from "@/lib/prompts/service";
import type { PromptDto } from "@/lib/prompts/types";

type RouteParams = { promptId: string };

const updatePromptSchema = z.object({
  text: z.string().trim().min(10).max(300).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = route<RouteParams>(async ({ ctx, request, params }) => {
  const input = updatePromptSchema.parse(await request.json());
  const prompt = await updatePrompt(ctx, params.promptId, input);
  return NextResponse.json({ data: prompt } satisfies ApiSuccess<PromptDto>);
});

export const DELETE = route<RouteParams>(async ({ ctx, params }) => {
  const result = await deletePrompt(ctx, params.promptId);
  return NextResponse.json({
    data: result,
  } satisfies ApiSuccess<{ deletedId: string }>);
});
