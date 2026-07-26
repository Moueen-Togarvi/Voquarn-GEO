import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBrandOwnership } from "@/lib/auth";
import {
  generateComparisonArticle,
  generateFAQ,
  generateListicleEntry,
  generateAnswerSnippet,
  type ContentBrand,
} from "@/lib/execution/content-generator";

export const maxDuration = 120;

const bodySchema = z.object({
  type: z.enum(["comparison", "faq", "listicle", "snippet"]),
  // For comparison: the competitor. For snippet: the prompt text.
  target: z.string().optional(),
});

/**
 * POST /api/brands/[id]/content — generate a GEO content asset for the brand.
 * Body: { type, target? }.
 */
export async function POST(
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { type, target } = parsed.data;

  const brandRow = await db.brand.findUnique({
    where: { id },
    include: {
      competitors: { select: { name: true } },
      prompts: { select: { text: true } },
    },
  });
  if (!brandRow) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const brand: ContentBrand = {
    name: brandRow.name,
    domain: brandRow.domain,
    industry: brandRow.industry,
    description: brandRow.description,
  };

  try {
    let content;
    switch (type) {
      case "comparison": {
        const competitor = target ?? brandRow.competitors[0]?.name;
        if (!competitor) {
          return NextResponse.json(
            { error: "No competitor available for comparison" },
            { status: 400 },
          );
        }
        content = await generateComparisonArticle(brand, competitor);
        break;
      }
      case "faq":
        content = await generateFAQ(
          brand,
          brandRow.prompts.map((p) => p.text),
        );
        break;
      case "listicle":
        content = await generateListicleEntry(brand);
        break;
      case "snippet": {
        if (!target) {
          return NextResponse.json(
            { error: "A prompt is required for a snippet" },
            { status: 400 },
          );
        }
        content = await generateAnswerSnippet(brand, target);
        break;
      }
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("[api/content] generation failed:", error);
    return NextResponse.json(
      { error: "Content generation failed" },
      { status: 502 },
    );
  }
}
