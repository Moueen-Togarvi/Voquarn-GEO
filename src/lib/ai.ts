// Shared model-router helpers for the platform's own AI features
// (prompt generation, sentiment, gap analysis, content generation) — distinct
// from src/lib/engines/, which queries providers to measure brand visibility.
import {
  AGENT_ROUTER_MODELS,
  completeWithAgentRouter,
  isAgentRouterConfigured,
} from "@/lib/agent-router";

/** Model tier flag lets non-critical calls use a cheaper model to save cost. */
const useCheapModel = process.env.AI_MODEL_TIER === "cheap";

/** Flagship model for content that ships to clients. */
export const SMART_MODEL = AGENT_ROUTER_MODELS.claude;
/** Cheaper model for internal/non-critical calls (sentiment, dev prompt gen). */
export const FAST_MODEL = useCheapModel
  ? AGENT_ROUTER_MODELS.glm
  : AGENT_ROUTER_MODELS.claude;

/**
 * Run a platform-owned completion through the configured agent router.
 */
export async function completeText(opts: {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  if (!isAgentRouterConfigured()) {
    throw new Error("Agent router is not configured");
  }

  return completeWithAgentRouter(opts);
}

/**
 * Extract a JSON value from an LLM response, tolerating markdown code fences
 * and surrounding prose. Returns null if nothing parseable is found.
 */
export function extractJson<T>(raw: string): T | null {
  // Strip ```json ... ``` or ``` ... ``` fences.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();

  // First try the whole candidate, then the widest [...] / {...} slice.
  const attempts = [candidate];
  const arrayMatch = candidate.match(/\[[\s\S]*\]/);
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  if (arrayMatch) attempts.push(arrayMatch[0]);
  if (objectMatch) attempts.push(objectMatch[0]);

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
