import {
  computeWeightedScore,
  type WeightedComponentBreakdown,
} from "@/lib/scoring/weighted";
import type { OpportunityComponentId } from "@/lib/opportunity/types";

export const OPPORTUNITY_SCORE_NAME = "opportunity-v1";
export const OPPORTUNITY_SCORE_VERSION = 1;

/**
 * Points out of 100. Same masked-weighted-sum shape as ThreatScore (A1 #2 in
 * the implementation plan) via the shared src/lib/scoring/weighted.ts
 * primitive — not the strategy document's
 * (fit × demand × gap × evidence) / (effort × competition × risk) formula,
 * which is numerically unstable and unexplainable to a user. `demand` in the
 * document's sense (real search volume) has no data source in this
 * codebase yet, so keywordPriority — a human-set signal already on
 * ProjectKeyword — stands in for it rather than inventing a fake number.
 */
export const OPPORTUNITY_COMPONENT_WEIGHTS: Record<
  OpportunityComponentId,
  number
> = {
  gapSeverity: 40,
  competitiveCoverage: 25,
  keywordPriority: 15,
  evidenceStrength: 10,
  citationPressure: 10,
};

export type OpportunityComponentBreakdown = WeightedComponentBreakdown;

export type OpportunityScoreResult = {
  value: number;
  confidence: number;
  components: Record<OpportunityComponentId, OpportunityComponentBreakdown>;
};

export function computeOpportunityScore(
  inputs: Partial<Record<OpportunityComponentId, number | null>>,
): OpportunityScoreResult {
  return computeWeightedScore(OPPORTUNITY_COMPONENT_WEIGHTS, inputs);
}
