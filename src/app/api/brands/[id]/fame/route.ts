import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBrandOwnership } from "@/lib/auth";
import { buildFamePlan } from "@/lib/execution/fame-plan";

export const maxDuration = 120;

/**
 * GET /api/brands/[id]/fame — the brand's Fame Plan tasks. ?refresh=1 rebuilds
 * the plan from the latest gap analysis first.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  }

  if (new URL(req.url).searchParams.get("refresh") === "1") {
    await buildFamePlan(id);
  }

  const tasks = await db.fameTask.findMany({
    where: { brandId: id },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  const integrations = await db.integration.findMany({
    where: { brandId: id },
    select: { id: true, provider: true, siteUrl: true },
  });

  return NextResponse.json({ tasks, integrations });
}
