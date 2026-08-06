import type { ProjectKeywordPriority } from "@/generated/prisma/enums";

/**
 * Every normalizer here returns null — never 0 — when there isn't enough
 * evidence to compute it at all, same contract as src/lib/scoring/normalize.ts.
 * computeOpportunityScore() (src/lib/opportunity/score.ts) masks a null
 * component out and redistributes its weight, rather than reading "no
 * data" as "bad."
 */

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * A human-set signal of how much this topic matters, reused as-is rather
 * than invented — ProjectKeyword.priority already exists for this purpose.
 * null when the topic has no tracked keyword at all (not every topic does).
 */
export function normalizeKeywordPriority(
  priority: ProjectKeywordPriority | null,
): number | null {
  if (priority === null) return null;
  const scale: Record<ProjectKeywordPriority, number> = {
    LOW: 1 / 3,
    MEDIUM: 2 / 3,
    HIGH: 1,
  };
  return scale[priority];
}

/** Fraction of tracked competitors with matching coverage — how contested this gap is. */
export function normalizeCompetitiveCoverage(
  matchedCompetitors: number,
  totalTrackedCompetitors: number,
): number | null {
  if (totalTrackedCompetitors <= 0) return null;
  return clamp01(matchedCompetitors / totalTrackedCompetitors);
}

/** How many independent observations back this detection — more evidence, more confidence it's real and not a fluke. */
export function normalizeEvidenceStrength(
  evidenceCount: number,
  cap = 5,
): number | null {
  if (evidenceCount <= 0) return null;
  return clamp01(evidenceCount / cap);
}
