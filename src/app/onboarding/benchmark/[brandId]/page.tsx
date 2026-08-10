import { notFound } from "next/navigation";

import { OnboardingBenchmark } from "@/components/onboarding-benchmark";
import { OnboardingShell } from "@/components/onboarding-shell";
import { requireWorkspaceContext } from "@/lib/auth/context";
import {
  getCompetitorMentionStats,
  getLatestAggregate,
} from "@/lib/benchmark/service";
import { sentimentScore } from "@/lib/benchmark/aggregate";
import { getBrand } from "@/lib/brands/service";
import { detectCitationGaps } from "@/lib/opportunity/detectors";
import { getBenchmarkCitationShares } from "@/lib/opportunity/service";
import { getLatestOperationForBrand } from "@/lib/operations/service";
import { listPrompts } from "@/lib/prompts/service";

export const metadata = { title: "Run your AI benchmark" };

function activeOperationId(
  operation: {
    id: string;
    status: string;
  } | null,
): string | null {
  return operation &&
    (operation.status === "PENDING" || operation.status === "RUNNING")
    ? operation.id
    : null;
}

export default async function OnboardingBenchmarkPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const [prompts, mentionStats, latest, promptOperation, benchmarkOperation] =
    await Promise.all([
      listPrompts(ctx, brand.id),
      getCompetitorMentionStats(ctx, brand.id),
      getLatestAggregate(ctx, brand.id),
      getLatestOperationForBrand(ctx, brand.id, "PROMPT_GENERATION"),
      getLatestOperationForBrand(ctx, brand.id, "BENCHMARK_BATCH"),
    ]);

  const competitors = brand.competitors
    .filter(
      (competitor) =>
        (competitor.tier === "TOP" || !competitor.tier) &&
        (competitor.status === "ACCEPTED" || competitor.status === "PINNED"),
    )
    .sort(
      (a, b) =>
        (mentionStats.stats[b.id]?.visibility ?? -1) -
        (mentionStats.stats[a.id]?.visibility ?? -1),
    )
    .slice(0, 30);
  const benchmarkComplete =
    latest?.batch.status === "COMPLETED" ||
    latest?.batch.status === "PARTIAL_FAILURE";

  // Only computed once there's enough signal to be meaningful — the pure
  // detector needs no crawl/embeddings/LLM call, but running it against a
  // still-trickling-in partial result would flicker a premature count.
  const gapCount = benchmarkComplete
    ? detectCitationGaps(await getBenchmarkCitationShares(ctx, brand.id)).length
    : 0;

  return (
    <OnboardingShell
      eyebrow="Step 3 of 3"
      title="Your AI market benchmark."
      lead="See every tracked competitor ranked across the prompts you approved, with evidence-backed visibility, share of voice, sentiment, position, and mentions."
    >
      <nav className="wizard-steps" aria-label="Onboarding progress">
        <span className="is-done">Add domain</span>
        <hr />
        <span className="is-done">Review prompts</span>
        <hr />
        <span className="is-current">AI benchmark</span>
      </nav>
      <OnboardingBenchmark
        brandId={brand.id}
        brandName={brand.name}
        prompts={prompts}
        competitors={competitors}
        mentionStats={mentionStats.stats}
        initialPromptOperationId={activeOperationId(promptOperation)}
        initialBenchmarkOperationId={activeOperationId(benchmarkOperation)}
        benchmarkHasData={(latest?.aggregate.sampleSize ?? 0) > 0}
        benchmarkComplete={benchmarkComplete}
        gapCount={gapCount}
        brandMetrics={{
          visibility: latest?.aggregate.visibility ?? null,
          shareOfVoice: latest?.aggregate.shareOfVoice ?? null,
          position: latest?.aggregate.avgPosition ?? null,
          sentiment:
            latest?.aggregate.sentimentDist == null
              ? null
              : sentimentScore({
                  POSITIVE: latest.aggregate.sentimentDist.POSITIVE ?? 0,
                  NEUTRAL: latest.aggregate.sentimentDist.NEUTRAL ?? 0,
                  NEGATIVE: latest.aggregate.sentimentDist.NEGATIVE ?? 0,
                }),
          sampleSize: latest?.aggregate.sampleSize ?? 0,
        }}
      />
    </OnboardingShell>
  );
}
