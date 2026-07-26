import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBrandOwnership } from "@/lib/auth";
import { analyzeGaps } from "@/lib/execution/gap-analysis";

export const maxDuration = 120;

/**
 * GET /api/brands/[id]/gaps — the brand's persisted gaps. Pass ?refresh=1 to
 * re-run gap analysis against the latest scan first.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json(
      { error: "Not authorized for this brand" },
      { status: access.status },
    );
  }

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  if (refresh) {
    await analyzeGaps(id);
  }

  const gaps = await db.gap.findMany({
    where: { brandId: id },
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ gaps });
}
