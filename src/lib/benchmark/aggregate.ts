import type { RunStatus, Sentiment } from "@/generated/prisma/enums";

export type RunOutcome = {
  status: RunStatus;
  refused?: boolean;
  brandMentioned?: boolean;
  mentionCount?: number;
  position?: number | null;
  sentiment?: Sentiment;
  competitorMentions?: Record<string, number>;
};

export type BenchmarkAggregateResult = {
  visibility: number | null;
  shareOfVoice: number | null;
  avgPosition: number | null;
  sentimentDist: Record<Sentiment, number>;
  sampleSize: number;
  refusedCount: number;
  failedCount: number;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Pure aggregation over a batch's runs — see docs/benchmark-protocol.md for
 * the definitions this implements exactly:
 *
 *   visibility   = mentioned / completed, EXCLUDING refusals from both sides
 *                  (folding refusals into the denominator biases visibility
 *                  downward, which is the one thing the protocol explicitly
 *                  forbids).
 *   shareOfVoice = brand mentions / all tracked-brand mentions, over the
 *                  same non-refused completed set.
 *   sampleSize   = every COMPLETED run, refused or not — refusedCount is
 *                  reported alongside it, never folded away.
 *   failedCount  = runs that never produced a usable answer at all
 *                  (timeout, transport error, malformed output).
 *
 * A batch with zero completed runs (everything still pending, or every run
 * failed) reports null ratios rather than 0 — a 0% visibility and an
 * unmeasured visibility are different claims, and this function must never
 * conflate them.
 */
export function computeAggregate(runs: RunOutcome[]): BenchmarkAggregateResult {
  const failedCount = runs.filter((run) => run.status === "FAILED").length;
  const completed = runs.filter((run) => run.status === "COMPLETED");
  const refusedCount = completed.filter((run) => run.refused).length;
  const scored = completed.filter((run) => !run.refused);
  const mentioned = scored.filter((run) => run.brandMentioned);

  const visibility =
    scored.length > 0 ? mentioned.length / scored.length : null;

  let totalBrandMentions = 0;
  let totalCompetitorMentions = 0;
  for (const run of scored) {
    totalBrandMentions += run.mentionCount ?? (run.brandMentioned ? 1 : 0);
    totalCompetitorMentions += Object.values(
      run.competitorMentions ?? {},
    ).reduce((total, count) => total + count, 0);
  }
  const totalMentions = totalBrandMentions + totalCompetitorMentions;
  const shareOfVoice =
    totalMentions > 0 ? totalBrandMentions / totalMentions : null;

  const positions = mentioned
    .map((run) => run.position)
    .filter((position): position is number => typeof position === "number");
  const avgPosition = average(positions);

  const sentimentDist: Record<Sentiment, number> = {
    POSITIVE: 0,
    NEUTRAL: 0,
    NEGATIVE: 0,
  };
  for (const run of mentioned) {
    if (run.sentiment) {
      sentimentDist[run.sentiment] += 1;
    }
  }

  return {
    visibility,
    shareOfVoice,
    avgPosition,
    sentimentDist,
    sampleSize: completed.length,
    refusedCount,
    failedCount,
  };
}
