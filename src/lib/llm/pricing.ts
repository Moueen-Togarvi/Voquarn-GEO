import type { LlmUsage } from "@/lib/llm/types";

export type PriceRate = {
  provider: string;
  model: string;
  /** ISO date. The most recent rate with effectiveFrom <= the call time wins. */
  effectiveFrom: string;
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
  currency: string;
};

/**
 * Date-effective so a price change never rewrites the cost of a call made
 * under the old price — see docs/cost-model.md, which is currently a
 * template with no measured figures. These rates are explicit zero-cost
 * placeholders, not a real quote: filling them in with a plausible-looking
 * number would be worse than leaving them visibly unmeasured, because a
 * wrong number silently corrupts every margin calculation downstream.
 */
const RATES: PriceRate[] = [
  {
    provider: "zai",
    model: "glm-5.2",
    effectiveFrom: "2026-01-01",
    inputPerMillionTokens: 0,
    outputPerMillionTokens: 0,
    currency: "USD",
  },
];

export function resolveRate(
  provider: string,
  model: string,
  at: Date = new Date(),
): PriceRate | null {
  const candidates = RATES.filter(
    (rate) =>
      rate.provider === provider &&
      rate.model === model &&
      new Date(rate.effectiveFrom) <= at,
  ).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  return candidates[0] ?? null;
}

export function calculateCost(
  provider: string,
  model: string,
  usage: LlmUsage,
  at?: Date,
): { costUnits: number; currency: string } | null {
  const rate = resolveRate(provider, model, at);
  if (!rate) return null;

  const costUnits =
    (usage.inputTokens / 1_000_000) * rate.inputPerMillionTokens +
    (usage.outputTokens / 1_000_000) * rate.outputPerMillionTokens;

  return { costUnits, currency: rate.currency };
}
