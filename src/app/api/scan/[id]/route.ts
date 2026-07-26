import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/scan/[id] — poll a scan run's status, its per-engine visibility
 * scores, and (once done) its results. Only the owner of the scan's brand may
 * read it.
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

  const scanRun = await db.scanRun.findUnique({
    where: { id },
    include: {
      brand: { select: { userId: true } },
      visibilityScores: true,
      results: {
        include: { prompt: { select: { text: true, category: true } } },
      },
    },
  });

  if (!scanRun) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }
  if (scanRun.brand.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: scanRun.id,
    status: scanRun.status,
    startedAt: scanRun.startedAt,
    completedAt: scanRun.completedAt,
    visibilityScores: scanRun.visibilityScores,
    results: scanRun.results.map((r) => ({
      id: r.id,
      engine: r.engine,
      prompt: r.prompt.text,
      category: r.prompt.category,
      brandMentioned: r.brandMentioned,
      position: r.position,
      sentiment: r.sentiment,
      citedSources: r.citedSources,
      responseText: r.responseText,
    })),
  });
}
