import { notFound } from "next/navigation";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { RunCrawlButton } from "@/components/run-crawl-button";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import {
  getLatestCrawlRun,
  listPageSnapshotsForCrawlRun,
} from "@/lib/crawl/service";
import type { PageSnapshotDetailDto } from "@/lib/crawl/types";
import { getCompetitorEvidence } from "@/lib/hunt/service";

export const metadata = { title: "Competitor autopsy" };

type Summary = {
  pageCount: number;
  avgWordCount: number | null;
  schemaCoverage: number | null;
};

function summarize(snapshots: PageSnapshotDetailDto[]): Summary {
  const withObservation = snapshots.filter((snapshot) => snapshot.observation);
  const avgWordCount =
    withObservation.length > 0
      ? Math.round(
          withObservation.reduce(
            (sum, snapshot) => sum + (snapshot.observation?.wordCount ?? 0),
            0,
          ) / withObservation.length,
        )
      : null;
  const schemaCoverage =
    snapshots.length > 0
      ? Math.round(
          (snapshots.filter((snapshot) => snapshot.schemas.length > 0).length /
            snapshots.length) *
            100,
        )
      : null;

  return { pageCount: snapshots.length, avgWordCount, schemaCoverage };
}

function compare(
  label: string,
  own: number | null,
  theirs: number | null,
  unit = "",
) {
  return (
    <li key={label}>
      <span>{label}</span>
      <strong>
        {own ?? "—"}
        {unit} vs {theirs ?? "—"}
        {unit}
      </strong>
    </li>
  );
}

export default async function CompetitorAutopsyPage({
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

  const [ownRun, competitorRun] = await Promise.all([
    getLatestCrawlRun(ctx, { brandId: brand.id }),
    getLatestCrawlRun(ctx, { competitorId }),
  ]);
  const [ownSnapshots, competitorSnapshots] = await Promise.all([
    ownRun ? listPageSnapshotsForCrawlRun(ctx, ownRun.id) : [],
    competitorRun ? listPageSnapshotsForCrawlRun(ctx, competitorRun.id) : [],
  ]);

  const ownSummary = summarize(ownSnapshots);
  const competitorSummary = summarize(competitorSnapshots);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Autopsy"
        title={`${brand.name} vs ${evidence.competitor.name}`}
        description="Side-by-side site comparison from each project's latest crawl."
        action={
          <RunCrawlButton
            endpoint={`/api/competitors/${competitorId}/crawl`}
            label="Crawl competitor"
          />
        }
      />

      <section className="metric-grid" aria-label="Autopsy comparison">
        <MetricCard
          label="Pages crawled"
          value={`${ownSummary.pageCount} / ${competitorSummary.pageCount}`}
          caption={`${brand.name} vs ${evidence.competitor.name}`}
        />
        <MetricCard
          label="Avg. word count"
          value={`${ownSummary.avgWordCount ?? "—"} / ${competitorSummary.avgWordCount ?? "—"}`}
          caption="Yours vs theirs"
        />
        <MetricCard
          label="Schema coverage"
          value={`${ownSummary.schemaCoverage ?? "—"}% / ${competitorSummary.schemaCoverage ?? "—"}%`}
          caption="Pages with structured data"
        />
      </section>

      <div className="content-card">
        <div className="card-heading">
          <h2>What we found</h2>
        </div>
        {!ownRun && !competitorRun ? (
          <p className="muted-text">
            Neither site has been crawled yet. Crawl your own site from the
            Pages tab, then crawl this competitor above.
          </p>
        ) : (
          <ul className="domain-summary-list">
            {compare(
              "Pages crawled",
              ownSummary.pageCount,
              competitorSummary.pageCount,
            )}
            {compare(
              "Avg. word count",
              ownSummary.avgWordCount,
              competitorSummary.avgWordCount,
            )}
            {compare(
              "Schema coverage",
              ownSummary.schemaCoverage,
              competitorSummary.schemaCoverage,
              "%",
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
