import type { AIEngine } from "@/lib/engines/types";
import { openaiEngine } from "@/lib/engines/openai";
import { claudeEngine } from "@/lib/engines/claude";

export type { AIEngine, EngineResponse } from "@/lib/engines/types";

/** Monitoring currently runs exclusively through the unified agent router. */
export const allEngines: AIEngine[] = [openaiEngine, claudeEngine];

/**
 * The engines with direct credentials or an agent-router fallback.
 */
export const engines: AIEngine[] = allEngines.filter((engine) => {
  if (!engine.isConfigured) {
    console.warn(
      `[engines] ${engine.label} (${engine.name}) is not configured — skipping.`,
    );
    return false;
  }
  return true;
});
