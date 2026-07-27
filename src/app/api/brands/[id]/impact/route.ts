import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { compareScans } from "@/lib/dashboard";

/**
 * GET /api/brands/[id]/impact — before/after comparison of the two most recent
 * scans, to measure the impact of completed Fame tasks.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const comparison = await compareScans(id, user.id);
  if (!comparison) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ comparison });
}
