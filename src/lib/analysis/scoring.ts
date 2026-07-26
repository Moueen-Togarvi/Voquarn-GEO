import { Engine } from "@/lib/types";

/**
 * The minimal per-result signal scoring needs. Kept independent of Prisma's
 * Result model so these functions stay pure and unit-testable.
 */
export interface ScoreableResult {
  engine: Engine;
  brandMentioned: boolean;
  /** How many of the tracked competitors were mentioned in this response. */
  competitorMentionCount: number;
  /** Whether the brand's own domain was cited in this response's sources. */
  domainCited: boolean;
}

/** Aggregated visibility metrics for one engine over one scan run. */
export interface EngineVisibility {
  engine: Engine;
  /** % of prompts where the brand was mentioned (0-100). */
  score: number;
  /** brand mentions / (brand + competitor mentions), 0-1. */
  shareOfVoice: number;
  /** % of prompts where the brand's domain was cited in sources (0-100). */
  citationRate: number;
  /** Number of results (prompts) that fed this engine's score. */
  sampleSize: number;
}

function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/**
 * Compute visibility metrics for a single engine from its results.
 */
export function calculateEngineVisibility(
  engine: Engine,
  results: ScoreableResult[],
): EngineVisibility {
  const sampleSize = results.length;
  if (sampleSize === 0) {
    return {
      engine,
      score: 0,
      shareOfVoice: 0,
      citationRate: 0,
      sampleSize: 0,
    };
  }

  const brandMentions = results.filter((r) => r.brandMentioned).length;
  const competitorMentions = results.reduce(
    (sum, r) => sum + r.competitorMentionCount,
    0,
  );
  const domainCitations = results.filter((r) => r.domainCited).length;

  const totalMentions = brandMentions + competitorMentions;

  return {
    engine,
    score: round((brandMentions / sampleSize) * 100),
    shareOfVoice:
      totalMentions === 0 ? 0 : round(brandMentions / totalMentions),
    citationRate: round((domainCitations / sampleSize) * 100),
    sampleSize,
  };
}

/**
 * Group results by engine and compute visibility for each engine that has at
 * least one result.
 */
export function calculateVisibility(
  results: ScoreableResult[],
): EngineVisibility[] {
  const byEngine = new Map<Engine, ScoreableResult[]>();
  for (const r of results) {
    const bucket = byEngine.get(r.engine);
    if (bucket) bucket.push(r);
    else byEngine.set(r.engine, [r]);
  }

  return [...byEngine.entries()].map(([engine, engineResults]) =>
    calculateEngineVisibility(engine, engineResults),
  );
}

/**
 * The overall visibility number shown as the headline gauge — the mean of the
 * per-engine `score` values, 0-100.
 */
export function overallScore(visibilities: EngineVisibility[]): number {
  if (visibilities.length === 0) return 0;
  const sum = visibilities.reduce((acc, v) => acc + v.score, 0);
  return round(sum / visibilities.length);
}
