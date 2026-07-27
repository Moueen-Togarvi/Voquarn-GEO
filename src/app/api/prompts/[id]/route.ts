import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const patchSchema = z.object({
  text: z.string().trim().min(3).optional(),
  category: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
});

/** Verify the signed-in user owns the brand this prompt belongs to. */
async function ownedPrompt(promptId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, status: 401 as const };
  const prompt = await db.prompt.findUnique({
    where: { id: promptId },
    include: { brand: { select: { userId: true } } },
  });
  if (!prompt) return { ok: false as const, status: 404 as const };
  if (prompt.brand.userId !== user.id)
    return { ok: false as const, status: 403 as const };
  return { ok: true as const };
}

/** PATCH /api/prompts/[id] — edit a prompt's text/category/tags. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await ownedPrompt(id);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updated = await db.prompt.update({
    where: { id },
    data: {
      ...(parsed.data.text !== undefined ? { text: parsed.data.text } : {}),
      ...(parsed.data.category !== undefined
        ? { category: parsed.data.category }
        : {}),
      ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
    },
  });
  return NextResponse.json({ prompt: updated });
}

/** DELETE /api/prompts/[id] — remove a prompt. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await ownedPrompt(id);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  }
  await db.prompt.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
