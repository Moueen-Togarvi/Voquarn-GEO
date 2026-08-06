import { z } from "zod";

import type { WorkspaceContext } from "@/lib/auth/context";
import { resolveDefault } from "@/lib/llm/registry";
import type { GenerateJsonInput, LlmMessage } from "@/lib/llm/types";
import type { DetectedGap } from "@/lib/opportunity/types";
import { withProviderCall } from "@/lib/providers/instrument";
import { childLogger } from "@/lib/observability/logger";

/**
 * The one LLM call in Phase 5. It receives an already-scored, already-typed
 * DetectedGap and only narrates it in plainer language — it never proposes a
 * kind, a score, or a number of any sort. See A10 in the implementation
 * plan: the model is not the source of truth here, the detector is.
 */
export const explainedOpportunitySchema = z.object({
  title: z.string().trim().min(5).max(120),
  summary: z.string().trim().min(10).max(400),
  recommendedActions: z.array(z.string().trim().min(5).max(200)).min(1).max(3),
});

export type ExplainedOpportunity = z.infer<typeof explainedOpportunitySchema>;

export function buildExplainMessages(
  gap: DetectedGap,
  context: { brandName: string },
): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a pragmatic content strategist writing for a busy marketer.",
        "You are given a content gap that has already been detected and scored by a rules-based system — your only job is to explain it in plainer, more specific language and suggest 1 to 3 concrete next actions.",
        "Never invent facts, evidence, numbers, or URLs beyond what is given to you. Never change the substance of the finding.",
        'Return strict JSON only, matching this shape: {"title":"...","summary":"...","recommendedActions":["..."]}.',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Brand: ${context.brandName}`,
        `Gap kind: ${gap.kind}`,
        `Current title: ${gap.title}`,
        `Current summary: ${gap.summary}`,
        `Current recommended actions: ${gap.recommendedActions.join("; ")}`,
        `Evidence: ${gap.evidence.map((item) => item.note ?? item.url ?? item.sourceId).join("; ")}`,
      ].join("\n"),
    },
  ];
}

export function buildExplainRequest(
  gap: DetectedGap,
  context: { brandName: string },
): GenerateJsonInput<ExplainedOpportunity> {
  return {
    messages: buildExplainMessages(gap, context),
    schema: explainedOpportunitySchema,
    temperature: 0.3,
    maxTokens: 600,
  };
}

/**
 * Best-effort upgrade of a detector's deterministic title/summary/actions —
 * never throws. Callers keep the deterministic DetectedGap fields on any
 * failure (no ZAI_API_KEY, provider error, malformed JSON), the same
 * degrade-gracefully posture as Browserless/CrUX in Phase 4: the feature
 * works with nothing configured, and gets better with a key.
 */
export async function explainOpportunity(
  ctx: WorkspaceContext,
  input: { gap: DetectedGap; brandName: string; operationId?: string },
): Promise<ExplainedOpportunity | null> {
  if (!process.env.ZAI_API_KEY) return null;

  try {
    const provider = resolveDefault("generation");
    const result = await withProviderCall(
      ctx,
      {
        capability: "GENERATION",
        provider: provider.provider,
        model: provider.model,
        operationId: input.operationId,
      },
      () =>
        provider.generateJson(
          buildExplainRequest(input.gap, { brandName: input.brandName }),
        ),
    );
    return result.content;
  } catch (error) {
    childLogger({ fn: "explainOpportunity" }).warn(
      { err: error instanceof Error ? error.message : String(error) },
      "opportunity explanation failed, keeping deterministic text",
    );
    return null;
  }
}
