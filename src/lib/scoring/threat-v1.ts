import {
  computeWeightedScore,
  type WeightedComponentBreakdown,
} from "@/lib/scoring/weighted";

export const THREAT_SCORE_NAME = "threat-v1";
export const THREAT_SCORE_VERSION = 1;

export type ThreatComponentId =
  | "serpOverlap"
  | "prominence"
  | "citationShare"
  | "authorityProxy"
  | "freshness"
  | "backlinks";

/**
 * Points out of 100, per §7.1 of the implementation plan. authorityProxy,
 * freshness, and backlinks are reserved slots — nothing in the codebase
 * computes them yet (authorityProxy needs a Domain Analytics call this
 * phase doesn't make, freshness needs Phase 4's crawl data, backlinks needs
 * Expansion D) — so every caller in Phase 3 passes null for them, and
 * computeThreatScore() masks them out rather than treating absence as zero.
 */
export const THREAT_COMPONENT_WEIGHTS: Record<ThreatComponentId, number> = {
  serpOverlap: 35,
  prominence: 20,
  citationShare: 15,
  authorityProxy: 10,
  freshness: 10,
  backlinks: 10,
};

export type ThreatComponentInputs = Partial<
  Record<ThreatComponentId, number | null>
>;

export type ThreatComponentBreakdown = WeightedComponentBreakdown;

export type ThreatScoreResult = {
  value: number;
  confidence: number;
  evidenceCount: number;
  components: Record<ThreatComponentId, ThreatComponentBreakdown>;
};

/**
 * Weighted sum of 0-1 normalized components — not the strategy document's
 * multiplicative formula. See A1 #2 in the implementation plan and
 * src/lib/scoring/weighted.ts, the shared primitive this delegates to
 * (also used by Opportunity scoring in Phase 5). `confidence` is the
 * fraction of the total 100 points actually backed by evidence, so "missing
 * data reduces confidence; it never becomes a zero" is provable, not just a
 * design intent.
 *
 * Pure and deterministic: recomputing from the same inputs always yields
 * byte-identical output, which is the actual exit requirement — a score
 * must be reproducible from the evidence that produced it.
 */
export function computeThreatScore(
  inputs: ThreatComponentInputs,
  evidenceCount: number,
): ThreatScoreResult {
  const { value, confidence, components } = computeWeightedScore(
    THREAT_COMPONENT_WEIGHTS,
    inputs,
  );
  return { value, confidence, evidenceCount, components };
}
