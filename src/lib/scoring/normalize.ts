/**
 * Every normalizer here returns null — never 0 — when there isn't enough
 * evidence to compute it at all. computeThreatScore() (threat-v1.ts) treats
 * null as "mask this component out and redistribute its weight," which is
 * what keeps "no data yet" from silently reading as "bad." See A1 #2 in the
 * implementation plan.
 */

/** Fraction of the client's tracked keywords a competitor appears in at all. */
export function normalizeSerpOverlap(
  keywordsAppearedIn: number,
  totalTrackedKeywords: number,
): number | null {
  if (totalTrackedKeywords <= 0) return null;
  return clamp01(keywordsAppearedIn / totalTrackedKeywords);
}

/**
 * Average rank quality across every SERP appearance, mapped linearly from
 * position 1 (score 1) down to `worstPositionConsidered` and beyond (score
 * 0). 20 is roughly "page two" — a competitor that only shows up past that
 * contributes nothing to prominence, but still counts toward serpOverlap.
 */
export function normalizeProminence(
  positions: number[],
  worstPositionConsidered = 20,
): number | null {
  if (positions.length === 0) return null;

  const scores = positions.map((position) => {
    if (position <= 1) return 1;
    if (position >= worstPositionConsidered) return 0;
    return 1 - (position - 1) / (worstPositionConsidered - 1);
  });

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

/** The competitor's share of tracked-brand mentions in the AI benchmark, reusing Phase 2's BenchmarkAggregate data. */
export function normalizeCitationShare(
  competitorMentions: number,
  brandMentions: number,
): number | null {
  const total = competitorMentions + brandMentions;
  if (total <= 0) return null;
  return clamp01(competitorMentions / total);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
