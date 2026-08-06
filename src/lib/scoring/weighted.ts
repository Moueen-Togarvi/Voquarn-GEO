/**
 * The masked weighted-sum scoring shape used by every score in this codebase
 * — ThreatScore (src/lib/scoring/threat-v1.ts, Phase 3) and Opportunity
 * (src/lib/opportunity/score.ts, Phase 5). See A1 #2 in the implementation
 * plan: a product of components (the strategy document's original formula)
 * lets one zero-evidence component annihilate an otherwise well-evidenced
 * score, which is exactly backwards. A component with no evidence
 * (value === null) is masked out entirely — never coerced to 0 — and its
 * weight is redistributed across whichever components do have evidence,
 * renormalizing to a full 0-100 range. `confidence` is the fraction of the
 * total weight actually backed by evidence, so "missing data reduces
 * confidence; it never becomes a zero" is provable, not just a design
 * intent.
 *
 * Pure and deterministic: recomputing from the same inputs always yields a
 * byte-identical result.
 */

export type WeightedComponentInputs<K extends string> = Partial<
  Record<K, number | null>
>;

export type WeightedComponentBreakdown = {
  weight: number;
  value: number | null;
  contribution: number | null;
};

export type WeightedScoreResult<K extends string> = {
  value: number;
  confidence: number;
  components: Record<K, WeightedComponentBreakdown>;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function computeWeightedScore<K extends string>(
  weights: Record<K, number>,
  inputs: WeightedComponentInputs<K>,
): WeightedScoreResult<K> {
  const ids = Object.keys(weights) as K[];
  const components = {} as Record<K, WeightedComponentBreakdown>;
  let weightedSum = 0;
  let presentWeight = 0;
  let totalWeight = 0;

  for (const id of ids) {
    const weight = weights[id];
    totalWeight += weight;
    const raw = inputs[id];
    const value = raw === null || raw === undefined ? null : clamp01(raw);

    components[id] = {
      weight,
      value,
      contribution: value === null ? null : round(value * weight, 4),
    };

    if (value !== null) {
      weightedSum += value * weight;
      presentWeight += weight;
    }
  }

  const value =
    presentWeight > 0
      ? round((weightedSum / presentWeight) * totalWeight, 2)
      : 0;
  const confidence =
    totalWeight > 0 ? round(presentWeight / totalWeight, 4) : 0;

  return { value, confidence, components };
}
