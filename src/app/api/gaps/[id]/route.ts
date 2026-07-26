import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const bodySchema = z.object({ addressed: z.boolean() });

/** PATCH /api/gaps/[id] — mark a gap addressed/not (owner-gated via its brand). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const gap = await db.gap.findUnique({
    where: { id },
    include: { brand: { select: { userId: true } } },
  });
  if (!gap) {
    return NextResponse.json({ error: "Gap not found" }, { status: 404 });
  }
  if (gap.brand.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.gap.update({
    where: { id },
    data: { addressed: parsed.data.addressed },
  });

  return NextResponse.json({ gap: updated });
}
