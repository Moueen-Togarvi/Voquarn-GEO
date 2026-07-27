import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FameTaskStatus } from "@/lib/types";

const bodySchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
});

/** PATCH /api/fame-tasks/[id] — update a Fame task's status (owner-gated). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = await db.fameTask.findUnique({
    where: { id },
    include: { brand: { select: { userId: true } } },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (task.brand.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updated = await db.fameTask.update({
    where: { id },
    data: { status: parsed.data.status as FameTaskStatus },
  });
  return NextResponse.json({ task: updated });
}
