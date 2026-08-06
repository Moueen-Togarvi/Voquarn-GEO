import { z } from "zod";

import type { LlmMessage } from "@/lib/llm/types";

/**
 * Pure — no @/lib/db import anywhere in this module's graph, unlike
 * judge.ts (which calls generateStructured and so transitively imports the
 * database module). Kept separate so the rubric/prompt shape is
 * unit-testable without a database, same split as src/lib/llm/repair.ts vs
 * structured.ts.
 *
 * "LLM-as-judge with a fixed rubric is acceptable only if calibrated
 * against a human-labelled set and versioned via QualityScore.judgeVersion"
 * — bump this whenever the rubric or prompt changes, never silently.
 */
export const QUALITY_JUDGE_VERSION = "quality-judge-v1";

export const qualityJudgeSchema = z.object({
  intentSatisfaction: z
    .number()
    .min(0)
    .max(1)
    .describe("Does this fully answer what the target keyword/topic asks?"),
  originalContribution: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "First-party expertise/perspective, not a rehash of competitors.",
    ),
  evidenceCoverage: z
    .number()
    .min(0)
    .max(1)
    .describe("How well are claims backed by sources or first-party input."),
  completeness: z
    .number()
    .min(0)
    .max(1)
    .describe("Covers the brief's outline without unnecessary padding."),
  brandFit: z
    .number()
    .min(0)
    .max(1)
    .describe("Matches the brand's stated tone/audience/voice samples."),
  readability: z
    .number()
    .min(0)
    .max(1)
    .describe("Clear structure, plain language, accessible to the audience."),
  internalLinkRelevance: z
    .number()
    .min(0)
    .max(1)
    .describe("Internal link candidates from the brief are used sensibly."),
  policyCompliance: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "1 = no policy/compliance risk, 0 = high risk (inverted from the document's 'policy risk' framing so higher is always better here).",
    ),
  notes: z.string().max(1000).optional(),
});

export type QualityJudgeResult = z.infer<typeof qualityJudgeSchema>;

export function buildQualityJudgeMessages(input: {
  title: string;
  plainText: string;
  brandName: string;
  brandTone: string | null;
  outline: unknown;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an exacting editorial reviewer scoring one content draft against a fixed rubric.",
        "Score each of the 8 dimensions from 0 to 1. Do not give every dimension the same score — differentiate based on what you actually observe.",
        "You are not deciding whether to approve or reject; a separate deterministic system already checks for unsourced claims, placeholders, and risky content. Your job is only to rate quality on the dimensions given.",
        'Return strict JSON only, matching this shape: {"intentSatisfaction":0-1,"originalContribution":0-1,"evidenceCoverage":0-1,"completeness":0-1,"brandFit":0-1,"readability":0-1,"internalLinkRelevance":0-1,"policyCompliance":0-1,"notes":"..."}.',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Brand: ${input.brandName}`,
        input.brandTone ? `Brand tone: ${input.brandTone}` : null,
        `Title: ${input.title}`,
        `Brief outline: ${JSON.stringify(input.outline)}`,
        `Draft text:\n${input.plainText}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}
