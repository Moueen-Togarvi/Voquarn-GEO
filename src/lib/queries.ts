import { db } from "@/lib/db";

export interface BrandCard {
  id: string;
  name: string;
  domain: string;
  industry: string;
  competitorCount: number;
  promptCount: number;
  latestScore: number | null;
  lastScanAt: Date | null;
}

/** Fetch a user's brands with their latest average visibility score. */
export async function getUserBrands(userId: string): Promise<BrandCard[]> {
  const brands = await db.brand.findMany({
    where: { userId },
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

  return brands.map((b) => {
    const latest = b.scanRuns[0];
    const scores = latest?.visibilityScores ?? [];
    const latestScore =
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
      latestScore,
      lastScanAt: latest?.startedAt ?? null,
    };
  });
}
