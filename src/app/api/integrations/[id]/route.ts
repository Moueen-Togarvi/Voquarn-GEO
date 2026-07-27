import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** DELETE /api/integrations/[id] — disconnect a publishing destination. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await db.integration.findUnique({
    where: { id },
    include: { brand: { select: { userId: true } } },
  });
  if (!integration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (integration.brand.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.integration.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
