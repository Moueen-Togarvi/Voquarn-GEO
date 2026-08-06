import {
  computeWeightedScore,
  type WeightedComponentBreakdown,
} from "@/lib/scoring/weighted";

export const QUALITY_SCORE_NAME = "quality-v1";
export const QUALITY_SCORE_VERSION = 1;

export type QualityComponentId =
  | "intentSatisfaction"
  | "originalContribution"
  | "evidenceCoverage"
  | "completeness"
  | "brandFit"
  | "readability"
  | "internalLinkRelevance"
  | "policyCompliance";

/**
 * Points out of 100, from the strategy document's "Quality score dimensions"
 * list — renamed one for consistency: the document calls the last dimension
 * "policy/compliance risk," but every other dimension here is "higher is
 * better." Inverting it to policyCompliance (1 = fully compliant, 0 = high
 * risk) keeps that invariant true across all eight instead of making one
 * component secretly backwards. Same masked-weighted-sum shape as
 * ThreatScore/Opportunity (src/lib/scoring/weighted.ts) — advisory only,
 * never the sole approval gate; see src/lib/content/blockers.ts for what
 * actually blocks.
 */
export const QUALITY_COMPONENT_WEIGHTS: Record<QualityComponentId, number> = {
  evidenceCoverage: 20,
  intentSatisfaction: 15,
  completeness: 15,
  brandFit: 10,
  readability: 10,
  originalContribution: 10,
  internalLinkRelevance: 10,
  policyCompliance: 10,
};

export type QualityComponentBreakdown = WeightedComponentBreakdown;

export type QualityScoreResult = {
  value: number;
  confidence: number;
  components: Record<QualityComponentId, QualityComponentBreakdown>;
};

export function computeQualityScore(
  inputs: Partial<Record<QualityComponentId, number | null>>,
): QualityScoreResult {
  return computeWeightedScore(QUALITY_COMPONENT_WEIGHTS, inputs);
}
