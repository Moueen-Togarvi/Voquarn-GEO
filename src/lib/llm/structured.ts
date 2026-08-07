import type { ProviderCapability } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import { MAX_REPAIR_ATTEMPTS, buildRepairMessages } from "@/lib/llm/repair";
import type {
  GenerateJsonInput,
  LlmProvider,
  LlmResult,
} from "@/lib/llm/types";
import { StructuredParseError } from "@/lib/llm/types";
import { withProviderCall } from "@/lib/providers/instrument";

export { MAX_REPAIR_ATTEMPTS, buildRepairMessages } from "@/lib/llm/repair";

/**
 * Content generation asks the model for structured JSON far more often and
 * for far larger, more failure-prone shapes (outlines, section drafts,
 * claim lists) than any earlier phase — worth a real repair loop rather
 * than letting the first malformed response fail the whole step. Each
 * attempt (including repairs) goes through withProviderCall separately, so
 * every attempt is its own ProviderCall row under the same operationId —
 * literally "recorded on the ProviderCall," and consistent with how an
 * Inngest-level retry already produces multiple rows elsewhere in this
 * codebase, rather than inventing a second bookkeeping mechanism.
 *
 * The OpenAI adapter now uses native Structured Outputs, so repair should be
 * rare. Keeping the loop at the provider-neutral layer still protects future
 * adapters and records every retry as its own auditable ProviderCall.
 */
export async function generateStructured<T>(
  ctx: WorkspaceContext,
  spec: {
    capability: ProviderCapability;
    provider: LlmProvider;
    operationId?: string;
  },
  input: GenerateJsonInput<T>,
  maxRepairAttempts = MAX_REPAIR_ATTEMPTS,
): Promise<LlmResult<T>> {
  let messages = input.messages;

  for (let attempt = 1; ; attempt++) {
    try {
      return await withProviderCall(
        ctx,
        {
          capability: spec.capability,
          provider: spec.provider.provider,
          model: spec.provider.model,
          operationId: spec.operationId,
        },
        () => spec.provider.generateJson({ ...input, messages }),
      );
    } catch (error) {
      if (
        !(error instanceof StructuredParseError) ||
        attempt > maxRepairAttempts
      ) {
        throw error;
      }

      messages = buildRepairMessages(messages, error);
    }
  }
}
