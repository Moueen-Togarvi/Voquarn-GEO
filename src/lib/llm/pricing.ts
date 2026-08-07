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
 * under an old price. GPT-5.6 Sol token rates below were verified against the
 * official model page on the effective date. OpenAI web-search tool-call fees
 * are not included here yet because LlmUsage currently tracks tokens only;
 * docs/cost-model.md records that accounting limitation.
 */
const RATES: PriceRate[] = [
  {
    provider: "openai",
    model: "gpt-5.6-sol",
    effectiveFrom: "2026-08-07",
    inputPerMillionTokens: 5,
    outputPerMillionTokens: 30,
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
