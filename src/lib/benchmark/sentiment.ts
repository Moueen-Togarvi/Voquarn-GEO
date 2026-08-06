import { z } from "zod";

import type { Sentiment } from "@/generated/prisma/enums";
import type { GenerateJsonInput, LlmMessage } from "@/lib/llm/types";

export const sentimentJudgeSchema = z.object({
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
});

export type SentimentJudgeResult = z.infer<typeof sentimentJudgeSchema>;

/** Default when sentiment is not (or cannot be) judged — nothing was said about the brand to have an opinion on. */
export const DEFAULT_SENTIMENT: Sentiment = "NEUTRAL";

/**
 * A separate, small LLM call from the answer generation itself — see
 * docs/benchmark-protocol.md on why analyzeAnswer() never asks the model to
 * judge itself. Only called when the brand was actually (non-refused)
 * mentioned; the caller defaults to DEFAULT_SENTIMENT otherwise.
 */
export function buildSentimentJudgeRequest(
  answerText: string,
  brandName: string,
): GenerateJsonInput<SentimentJudgeResult> {
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: `Classify how positively, neutrally, or negatively the following answer portrays "${brandName}" specifically — not the category in general. Return strict JSON only, matching the schema. If the brand is mentioned only in passing with no clear opinion expressed, use NEUTRAL.`,
    },
    { role: "user", content: answerText },
  ];

  return {
    messages,
    schema: sentimentJudgeSchema,
    webSearch: false,
    maxTokens: 30,
    temperature: 0,
  };
}
