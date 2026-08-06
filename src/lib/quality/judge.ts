import type { WorkspaceContext } from "@/lib/auth/context";
import { resolveDefault } from "@/lib/llm/registry";
import { generateStructured } from "@/lib/llm/structured";
import { childLogger } from "@/lib/observability/logger";
import {
  buildQualityJudgeMessages,
  qualityJudgeSchema,
  type QualityJudgeResult,
} from "@/lib/quality/rubric";

export { QUALITY_JUDGE_VERSION } from "@/lib/quality/rubric";

/**
 * Best-effort — never blocks the review flow. On any failure (no API key,
 * provider error, malformed JSON after repair), a ContentVersion simply has
 * no QualityScore yet; a reviewer can still approve or request changes
 * without one, since QualityScore is advisory (src/lib/content/blockers.ts
 * is what actually gates approval). Same degrade-gracefully posture as
 * src/lib/opportunity/explain.ts in Phase 5.
 */
export async function judgeQuality(
  ctx: WorkspaceContext,
  input: {
    title: string;
    plainText: string;
    brandName: string;
    brandTone: string | null;
    outline: unknown;
    operationId?: string;
  },
): Promise<QualityJudgeResult | null> {
  if (!process.env.ZAI_API_KEY) return null;

  try {
    const provider = resolveDefault("generation");
    const result = await generateStructured(
      ctx,
      { capability: "GENERATION", provider, operationId: input.operationId },
      {
        messages: buildQualityJudgeMessages(input),
        schema: qualityJudgeSchema,
        temperature: 0.2,
        maxTokens: 500,
      },
    );
    return result.content;
  } catch (error) {
    childLogger({ fn: "judgeQuality" }).warn(
      { err: error instanceof Error ? error.message : String(error) },
      "quality judge failed, leaving this version unscored",
    );
    return null;
  }
}
