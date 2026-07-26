import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBrandOwnership } from "@/lib/auth";
import { buildTechnicalAssets } from "@/lib/execution/technical";

/**
 * GET /api/brands/[id]/technical — copy-paste technical GEO assets (JSON-LD
 * Organization + Product schema, llms.txt) for the brand's domain.
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

  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const assets = buildTechnicalAssets({
    name: brand.name,
    domain: brand.domain,
    industry: brand.industry,
    description: brand.description,
  });

  return NextResponse.json({ assets });
}
