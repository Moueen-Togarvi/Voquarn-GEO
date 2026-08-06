import { notFound } from "next/navigation";
import { getBatch } from "@/lib/benchmark/service";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";

export const metadata = { title: "Run detail" };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  PARTIAL_FAILURE: "Partial failure",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const SENTIMENT_LABEL: Record<string, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
};

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ brandId: string; batchId: string }>;
}) {
  const { brandId, batchId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const batch = await getBatch(ctx, batchId);
  if (!batch || batch.brandId !== brand.id) notFound();

  const aggregate = batch.aggregate;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Measurement"
        title={`Run · ${new Date(batch.createdAt).toLocaleString()}`}
        description={`${STATUS_LABEL[batch.status] ?? batch.status} · ${batch.repetitions} repetition${batch.repetitions === 1 ? "" : "s"} · prompt set ${batch.promptSetHash.slice(0, 8)}`}
      />

      <section className="metric-grid" aria-label="Run results">
        <MetricCard
          label="Visibility"
          value={formatPercent(aggregate?.visibility ?? null)}
          caption="Runs mentioning your brand"
        />
        <MetricCard
          label="Share of voice"
          value={formatPercent(aggregate?.shareOfVoice ?? null)}
          caption="Your mentions vs competitors'"
        />
        <MetricCard
          label="Avg. position"
          value={
            aggregate?.avgPosition != null
              ? aggregate.avgPosition.toFixed(1)
              : "—"
          }
          caption="Average mention order"
        />
        <MetricCard
          label="Sample size"
          value={aggregate ? String(aggregate.sampleSize) : "—"}
          caption={
            aggregate
              ? `${aggregate.refusedCount} refused · ${aggregate.failedCount} failed`
              : "Completed runs"
          }
        />
      </section>

      <div className="content-card">
        <div className="card-heading">
          <h2>Runs</h2>
        </div>
        <div className="run-table-wrap">
          <table className="run-table">
            <thead>
              <tr>
                <th>Prompt</th>
                <th>Status</th>
                <th>Mentioned</th>
                <th>Position</th>
                <th>Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {batch.runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.promptText}</td>
                  <td>
                    <small className="status-pill">
                      {STATUS_LABEL[run.status] ?? run.status}
                    </small>
                  </td>
                  <td>
                    {run.analysis
                      ? run.analysis.refused
                        ? "Refused"
                        : run.analysis.brandMentioned
                          ? `Yes (${run.analysis.mentionCount})`
                          : "No"
                      : "—"}
                  </td>
                  <td>{run.analysis?.position ?? "—"}</td>
                  <td>
                    {run.analysis &&
                    run.analysis.brandMentioned &&
                    !run.analysis.refused
                      ? (SENTIMENT_LABEL[run.analysis.sentiment] ??
                        run.analysis.sentiment)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
