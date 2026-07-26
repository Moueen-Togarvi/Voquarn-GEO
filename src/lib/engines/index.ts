import type { AIEngine } from "@/lib/engines/types";
import { openaiEngine } from "@/lib/engines/openai";
import { claudeEngine } from "@/lib/engines/claude";
import { geminiEngine } from "@/lib/engines/gemini";
import { perplexityEngine } from "@/lib/engines/perplexity";

export type { AIEngine, EngineResponse } from "@/lib/engines/types";

/** Every engine the platform knows about, configured or not. */
export const allEngines: AIEngine[] = [
  openaiEngine,
  claudeEngine,
  geminiEngine,
  perplexityEngine,
];

/**
 * The engines with a valid API key. Unconfigured engines are skipped with a
 * warning so a missing key never fails a whole scan.
 */
export const engines: AIEngine[] = allEngines.filter((engine) => {
  if (!engine.isConfigured) {
    console.warn(
      `[engines] ${engine.label} (${engine.name}) has no API key — skipping.`,
    );
    return false;
  }
  return true;
});
