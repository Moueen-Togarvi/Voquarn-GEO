import { after, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { brandInputSchema } from "@/lib/validation/brand";
import { generatePrompts } from "@/lib/prompts/generator";
import { canCreateBrand } from "@/lib/billing/enforce";

/** GET /api/brands — list the signed-in user's brands with their latest score. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brands = await db.brand.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { competitors: true, prompts: true } },
      scanRuns: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: { visibilityScores: true },
      },
    },
  });

  const shaped = brands.map((b) => {
    const latest = b.scanRuns[0];
    const scores = latest?.visibilityScores ?? [];
    const avgScore =
      scores.length > 0
        ? Math.round(
            (scores.reduce((s, v) => s + v.score, 0) / scores.length) * 10,
          ) / 10
        : null;
    return {
      id: b.id,
      name: b.name,
      domain: b.domain,
      industry: b.industry,
      competitorCount: b._count.competitors,
      promptCount: b._count.prompts,
      latestScore: avgScore,
      lastScanAt: latest?.startedAt ?? null,
    };
  });

  return NextResponse.json({ brands: shaped });
}

/**
 * POST /api/brands — create a brand (+competitors), then generate prompts in
 * the background so the response returns quickly.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tier limit: brand count.
  const allowed = await canCreateBrand(user.id);
  if (!allowed.ok) {
    return NextResponse.json(
      { error: allowed.reason, upgrade: true },
      { status: 402 },
    );
  }

  const parsed = brandInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const brand = await db.brand.create({
    data: {
      userId: user.id,
      name: input.name,
      domain: input.domain,
      industry: input.industry,
      description: input.description || null,
      competitors: {
        create: input.competitors.map((name) => ({ name })),
      },
    },
  });

  // Populate buyer-intent prompts in the background — the UI can start the
  // brand page immediately and prompts appear shortly after.
  after(async () => {
    try {
      const prompts = await generatePrompts({
        name: input.name,
        industry: input.industry,
        description: input.description || null,
        competitors: input.competitors,
      });
      await db.prompt.createMany({
        data: prompts.map((p) => ({
          brandId: brand.id,
          text: p.text,
          category: p.category,
        })),
      });
      console.log(
        `[api/brands] generated ${prompts.length} prompts for "${brand.name}"`,
      );
    } catch (error) {
      console.error("[api/brands] prompt generation failed:", error);
    }
  });

  return NextResponse.json({ id: brand.id }, { status: 201 });
}
