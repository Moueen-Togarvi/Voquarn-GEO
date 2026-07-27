import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PromptSource } from "@/lib/types";

const bodySchema = z.object({ action: z.enum(["accept", "dismiss"]) });

/**
 * PATCH /api/suggestions/[id] — accept (→ creates a tracked Prompt) or dismiss
 * an AI-suggested prompt.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suggestion = await db.promptSuggestion.findUnique({
    where: { id },
    include: { brand: { select: { userId: true } } },
  });
  if (!suggestion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (suggestion.brand.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.data.action === "accept") {
    await db.$transaction([
      db.prompt.create({
        data: {
          brandId: suggestion.brandId,
          text: suggestion.text,
          category: suggestion.category,
          volume: suggestion.volume,
          source: PromptSource.AI_SUGGESTED,
        },
      }),
      db.promptSuggestion.update({
        where: { id },
        data: { accepted: true },
      }),
    ]);
  } else {
    await db.promptSuggestion.update({
      where: { id },
      data: { dismissed: true },
    });
  }

  return NextResponse.json({ ok: true });
}
