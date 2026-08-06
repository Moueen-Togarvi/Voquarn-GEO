import { FileSearch } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Sparkline } from "@/components/sparkline";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { getCompetitorEvidence } from "@/lib/hunt/service";
import type { ThreatComponentId } from "@/lib/scoring/threat-v1";

export const metadata = { title: "Competitor evidence" };

const COMPONENT_LABELS: Record<ThreatComponentId, string> = {
  serpOverlap: "SERP overlap",
  prominence: "Prominence",
  citationShare: "AI citation share",
  authorityProxy: "Authority",
  freshness: "Freshness",
  backlinks: "Backlinks",
};

const COMPONENT_ORDER: ThreatComponentId[] = [
  "serpOverlap",
  "prominence",
  "citationShare",
  "authorityProxy",
  "freshness",
  "backlinks",
];

function formatComponentValue(value: number | null): string {
  return value === null
    ? "Insufficient evidence"
    : `${Math.round(value * 100)}%`;
}

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ brandId: string; competitorId: string }>;
}) {
  const { brandId, competitorId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const evidence = await getCompetitorEvidence(ctx, competitorId);
  if (!evidence) notFound();

  const { competitor, latestScore, scoreHistory, observations } = evidence;
  const trend = [...scoreHistory].reverse().map((score) => score.value / 100);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Intelligence"
        title={competitor.name}
        description={`${competitor.domain} · Threat score reflects tracked-keyword SERP overlap, ranking prominence, and AI-benchmark citation share.`}
        action={
          <Link
            className="button button-secondary compact-button"
            href={`/projects/${brand.id}/competitors/${competitor.id}/autopsy`}
          >
            <FileSearch size={15} /> Site autopsy
          </Link>
        }
      />

      <section className="metric-grid" aria-label="Threat score">
        <MetricCard
          label="Threat score"
          value={latestScore ? Math.round(latestScore.value).toString() : "—"}
          caption="0–100, evidence-weighted"
        />
        <MetricCard
          label="Confidence"
          value={
            latestScore ? `${Math.round(latestScore.confidence * 100)}%` : "—"
          }
          caption="Share of components backed by evidence"
        />
        <MetricCard
          label="Keywords observed"
          value={latestScore ? String(latestScore.evidenceCount) : "—"}
          caption="Tracked keywords this competitor appears in"
        />
        <MetricCard
          label="Score history"
          value={scoreHistory.length > 1 ? "Trend" : "—"}
          caption={
            scoreHistory.length > 1 ? "" : "Run a hunt again to see a trend"
          }
        />
      </section>

      {trend.length >= 2 ? (
        <div className="content-card runs-trend">
          <div>
            <span className="page-eyebrow">Threat score trend</span>
            <strong>{Math.round((trend[trend.length - 1] ?? 0) * 100)}</strong>
          </div>
          <Sparkline values={trend} width={200} height={44} />
        </div>
      ) : null}

      <div className="overview-grid">
        <div className="content-card">
          <div className="card-heading">
            <h2>Why this score</h2>
          </div>
          <ul className="domain-summary-list">
            {COMPONENT_ORDER.map((id) => {
              const component = latestScore?.components[id];
              return (
                <li key={id}>
                  <span>{COMPONENT_LABELS[id]}</span>
                  <strong>
                    {formatComponentValue(component?.value ?? null)}
                  </strong>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="content-card">
          <div className="card-heading">
            <h2>Keyword evidence</h2>
          </div>
          {observations.length === 0 ? (
            <p className="muted-text">
              No SERP evidence yet. Run a hunt from the Competitors page.
            </p>
          ) : (
            <div className="run-table-wrap">
              <table className="run-table">
                <thead>
                  <tr>
                    <th>Keyword</th>
                    <th>Position</th>
                    <th>Observed</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map((observation, index) => (
                    <tr key={`${observation.keywordId}-${index}`}>
                      <td>{observation.keywordText}</td>
                      <td>{observation.position}</td>
                      <td>
                        {new Date(
                          observation.snapshotFetchedAt,
                        ).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
