import type { RunStatus, Sentiment } from "@/generated/prisma/enums";
import type { CompetitorMentionEntry } from "@/lib/benchmark/analysis";

export type RunOutcome = {
  status: RunStatus;
  refused?: boolean;
  brandMentioned?: boolean;
  mentionCount?: number;
  position?: number | null;
  sentiment?: Sentiment;
  /** Normalize via normalizeCompetitorMentions() before constructing a RunOutcome — this type accepts the current structured shape. */
  competitorMentions?: Record<string, CompetitorMentionEntry>;
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

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Peec-style 0–100 score: positive=100, neutral=50, negative=0. */
export function sentimentScore(
  distribution: Record<Sentiment, number>,
): number | null {
  const total = Object.values(distribution).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (total === 0) return null;
  return (distribution.POSITIVE * 100 + distribution.NEUTRAL * 50) / total;
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
    ).reduce((total, entry) => total + entry.count, 0);
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

export type CompetitorAggregateResult = {
  competitorId: string;
  mentionCount: number;
  mentionedRunCount: number;
  visibility: number | null;
  shareOfVoice: number | null;
  avgPosition: number | null;
  sentiment: Sentiment | null;
  sentimentDist: Record<Sentiment, number>;
  sentimentScore: number | null;
};

/**
 * Same scored/denominator basis as computeAggregate(), applied per
 * competitor instead of to the brand — visibility and shareOfVoice for a
 * competitor are directly comparable to the brand's own numbers because
 * both are computed over the identical run set with the identical
 * definitions.
 */
export function computeCompetitorAggregates(
  runs: RunOutcome[],
  competitorIds: string[],
): Record<string, CompetitorAggregateResult> {
  const scored = runs.filter(
    (run) => run.status === "COMPLETED" && !run.refused,
  );

  let totalMentions = 0;
  for (const run of scored) {
    totalMentions += run.mentionCount ?? (run.brandMentioned ? 1 : 0);
    totalMentions += Object.values(run.competitorMentions ?? {}).reduce(
      (total, entry) => total + entry.count,
      0,
    );
  }

  const results: Record<string, CompetitorAggregateResult> = {};
  for (const competitorId of competitorIds) {
    let mentionCount = 0;
    let mentionedRunCount = 0;
    const positions: number[] = [];
    const sentimentDist: Record<Sentiment, number> = {
      POSITIVE: 0,
      NEUTRAL: 0,
      NEGATIVE: 0,
    };

    for (const run of scored) {
      const entry = run.competitorMentions?.[competitorId];
      if (!entry || entry.count === 0) continue;
      mentionCount += entry.count;
      mentionedRunCount += 1;
      if (typeof entry.position === "number") positions.push(entry.position);
      if (entry.sentiment) sentimentDist[entry.sentiment] += 1;
    }

    const measuredSentiments = Object.entries(sentimentDist).filter(
      ([, count]) => count > 0,
    ) as Array<[Sentiment, number]>;
    const sentiment =
      measuredSentiments.length > 0
        ? measuredSentiments.reduce((best, current) =>
            current[1] > best[1] ? current : best,
          )[0]
        : null;

    results[competitorId] = {
      competitorId,
      mentionCount,
      mentionedRunCount,
      visibility: scored.length > 0 ? mentionedRunCount / scored.length : null,
      shareOfVoice: totalMentions > 0 ? mentionCount / totalMentions : null,
      avgPosition: average(positions),
      sentiment,
      sentimentDist,
      sentimentScore: sentimentScore(sentimentDist),
    };
  }

  return results;
}
