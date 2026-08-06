import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RunHuntButton } from "@/components/run-hunt-button";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { listCompetitorsWithLatestScore } from "@/lib/hunt/service";

export const metadata = { title: "Competitors" };

function formatScore(value: number | null | undefined): string {
  return value == null ? "—" : Math.round(value).toString();
}

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const competitors = await listCompetitorsWithLatestScore(ctx, brand.id);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Intelligence"
        title="Competitors"
        description="Threat scores are computed from SERP overlap, prominence, and AI-benchmark citation share — open a competitor to see the evidence behind its score."
        action={<RunHuntButton brandId={brand.id} />}
      />

      {competitors.length === 0 ? (
        <p className="muted-text">
          No tracked competitors yet. Accept competitors from your onboarding
          review, then run a hunt above.
        </p>
      ) : (
        <div className="content-card">
          <ul className="batch-list">
            {competitors.map((competitor) => (
              <li key={competitor.id}>
                <Link
                  className="batch-row"
                  href={`/projects/${brand.id}/competitors/${competitor.id}`}
                >
                  <span className="batch-status">
                    <ShieldAlert size={16} />
                  </span>
                  <span className="batch-row-copy">
                    <strong>{competitor.name}</strong>
                    <small>{competitor.domain}</small>
                  </span>
                  <span className="batch-row-metric">
                    <strong>
                      {formatScore(competitor.latestScore?.value)}
                    </strong>
                    <small>
                      {competitor.latestScore
                        ? `${Math.round(competitor.latestScore.confidence * 100)}% confidence`
                        : "not scored yet"}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
