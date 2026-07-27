import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBrandOwnership } from "@/lib/auth";
import { suggestPrompts } from "@/lib/prompts/generator";

export const maxDuration = 60;

/**
 * POST /api/brands/[id]/prompts/suggest — generate fresh AI-suggested prompts
 * (deduped against tracked prompts) and store them as PromptSuggestions.
 * GET returns the pending (not accepted/dismissed) suggestions.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  }

  const brand = await db.brand.findUnique({
    where: { id },
    include: {
      competitors: { select: { name: true } },
      prompts: { select: { text: true } },
    },
  });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const suggestions = await suggestPrompts(
    {
      name: brand.name,
      industry: brand.industry,
      description: brand.description,
      competitors: brand.competitors.map((c) => c.name),
    },
    brand.prompts.map((p) => p.text),
  );

  if (suggestions.length > 0) {
    await db.promptSuggestion.createMany({
      data: suggestions.map((s) => ({
        brandId: id,
        text: s.text,
        category: s.category,
        volume: s.volume,
        reason: s.reason,
      })),
    });
  }

  const pending = await db.promptSuggestion.findMany({
    where: { brandId: id, accepted: false, dismissed: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ suggestions: pending });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await requireBrandOwnership(id);
  if (!access.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: access.status });
  }

  const pending = await db.promptSuggestion.findMany({
    where: { brandId: id, accepted: false, dismissed: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ suggestions: pending });
}
