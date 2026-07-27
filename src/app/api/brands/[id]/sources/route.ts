import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBrandOwnership } from "@/lib/auth";
import {
  mapSources,
  generateOutreachList,
} from "@/lib/execution/source-mapping";
import { analyzeSourceInfluence } from "@/lib/execution/source-influence";

export const maxDuration = 120;

/**
 * GET /api/brands/[id]/sources — third-party pages likely to influence AI
 * answers for the brand, plus outreach opportunities (with drafted emails
 * where a human pitch makes sense).
 */
export async function GET(
  _req: Request,
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

  const brand = await db.brand.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const sources = await mapSources(id);
  const outreach = await generateOutreachList(brand.name, sources);
  // Domains the AI answers themselves referenced (works without citation APIs).
  const influence = await analyzeSourceInfluence(id);

  return NextResponse.json({
    sources,
    outreach,
    influence,
    serperConfigured: process.env.SERPER_API_KEY !== undefined,
  });
}
