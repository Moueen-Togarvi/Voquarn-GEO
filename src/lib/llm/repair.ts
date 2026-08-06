import type { LlmMessage } from "@/lib/llm/types";
import type { StructuredParseError } from "@/lib/llm/types";

export const MAX_REPAIR_ATTEMPTS = 2;

/**
 * Pure — no @/lib/db import anywhere in this module's graph, unlike
 * structured.ts (which calls withProviderCall and so transitively imports
 * the database module, which throws at import time without DATABASE_URL).
 * Kept in its own file specifically so this piece stays unit-testable
 * without a database — see the pure/dependency-free extraction pattern used
 * throughout this codebase (src/lib/crawl/*.ts, src/lib/scoring/*.ts, etc.).
 *
 * Appends the failed response and a correction instruction to the message
 * list for the next attempt.
 */
export function buildRepairMessages(
  messages: LlmMessage[],
  error: StructuredParseError,
): LlmMessage[] {
  return [
    ...messages,
    { role: "assistant", content: error.rawContent },
    {
      role: "user",
      content: `That response was invalid: ${error.message}. Return corrected JSON only, matching the required shape exactly — no explanation, no markdown fences.`,
    },
  ];
}
