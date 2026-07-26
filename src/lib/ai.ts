// Shared Anthropic client + helpers for the platform's own AI features
// (prompt generation, sentiment, gap analysis, content generation) — distinct
// from src/lib/engines/, which queries providers to measure brand visibility.
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

/** Model tier flag lets non-critical calls use a cheaper model to save cost. */
const useCheapModel = process.env.AI_MODEL_TIER === "cheap";

/** Flagship model for content that ships to clients. */
export const SMART_MODEL = "claude-sonnet-5";
/** Cheaper model for internal/non-critical calls (sentiment, dev prompt gen). */
export const FAST_MODEL = useCheapModel
  ? "claude-haiku-4-5"
  : "claude-sonnet-5";

let client: Anthropic | null = null;

/** Returns the shared Anthropic client, or null if no key is configured. */
export function getAnthropic(): Anthropic | null {
  if (!apiKey) return null;
  client ??= new Anthropic({ apiKey });
  return client;
}

/**
 * Ask Claude for a single text completion. Throws if the key is missing.
 */
export async function completeText(opts: {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const message = await anthropic.messages.create({
    model: opts.model ?? SMART_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
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
