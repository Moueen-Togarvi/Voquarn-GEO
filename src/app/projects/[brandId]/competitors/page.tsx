import { notFound } from "next/navigation";
import { getCompetitorMentionStats } from "@/lib/benchmark/service";
import { CompetitorTable } from "@/components/competitor-table";
import { FindMoreCompetitorsButton } from "@/components/find-more-competitors-button";
import { PageHeader } from "@/components/page-header";
import { RunHuntButton } from "@/components/run-hunt-button";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { listCompetitorsWithLatestScore } from "@/lib/hunt/service";

export const metadata = { title: "Competitors" };

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const [competitors, mentionStats] = await Promise.all([
    listCompetitorsWithLatestScore(ctx, brand.id),
    getCompetitorMentionStats(ctx, brand.id),
  ]);
  const topCompetitors = competitors
    .filter((competitor) => competitor.tier === "TOP" || !competitor.tier)
    .sort((a, b) => (b.latestScore?.value ?? -1) - (a.latestScore?.value ?? -1))
    .slice(0, 30);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Intelligence"
        title="Competitors"
        description="Threat scores are computed from SERP overlap, prominence, and AI-benchmark citation share; visibility and mentions come from your AI-benchmark prompt runs. Open a competitor to see the evidence behind its score."
        action={
          <>
            <FindMoreCompetitorsButton brandId={brand.id} />
            <RunHuntButton brandId={brand.id} />
          </>
        }
      />

      {topCompetitors.length === 0 ? (
        <p className="muted-text">
          No tracked competitors yet. Accept competitors from your onboarding
          review, then run a hunt above.
        </p>
      ) : (
        <div className="content-card">
          <CompetitorTable
            competitors={topCompetitors}
            mentionStats={mentionStats.stats}
            linkBase={(id) => `/projects/${brand.id}/competitors/${id}`}
          />
        </div>
      )}
    </div>
  );
}
