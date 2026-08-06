import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RunBatchButton } from "@/components/run-batch-button";
import { Sparkline } from "@/components/sparkline";
import { listBatchSummaries } from "@/lib/benchmark/service";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";

export const metadata = { title: "Runs" };

const STATUS_META = {
  PENDING: { label: "Pending", icon: Clock },
  RUNNING: { label: "Running", icon: Clock },
  COMPLETED: { label: "Completed", icon: CheckCircle2 },
  PARTIAL_FAILURE: { label: "Partial failure", icon: AlertTriangle },
  FAILED: { label: "Failed", icon: XCircle },
  CANCELLED: { label: "Cancelled", icon: XCircle },
} as const;

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export default async function RunsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const batches = await listBatchSummaries(ctx, brand.id);
  const trend = [...batches]
    .reverse()
    .map((batch) => batch.aggregate?.visibility)
    .filter((value): value is number => typeof value === "number");

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Measurement"
        title="Runs"
        description="Each run sends your active prompt set to the benchmark model and records whether your brand was mentioned."
        action={<RunBatchButton brandId={brand.id} />}
      />

      {trend.length >= 2 ? (
        <div className="content-card runs-trend">
          <div>
            <span className="page-eyebrow">Visibility trend</span>
            <strong>{formatPercent(trend[trend.length - 1] ?? null)}</strong>
          </div>
          <Sparkline values={trend} width={200} height={44} />
        </div>
      ) : null}

      {batches.length === 0 ? (
        <p className="muted-text">
          No runs yet. Make sure you have active prompts, then run your first
          analysis above.
        </p>
      ) : (
        <div className="content-card">
          <ul className="batch-list">
            {batches.map((batch) => {
              const meta = STATUS_META[batch.status];
              const Icon = meta.icon;
              return (
                <li key={batch.id}>
                  <Link
                    className="batch-row"
                    href={`/projects/${brand.id}/runs/${batch.id}`}
                  >
                    <span
                      className={`batch-status batch-status-${batch.status.toLowerCase()}`}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="batch-row-copy">
                      <strong>{meta.label}</strong>
                      <small>
                        {new Date(batch.createdAt).toLocaleString()} ·{" "}
                        {batch.completedRuns + batch.failedRuns} of{" "}
                        {batch.totalRuns} runs
                      </small>
                    </span>
                    <span className="batch-row-metric">
                      <strong>
                        {formatPercent(batch.aggregate?.visibility ?? null)}
                      </strong>
                      <small>visibility</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
