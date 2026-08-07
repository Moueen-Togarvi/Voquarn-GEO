import type {
  GenerateJsonInput,
  GenerateTextInput,
  LlmResult,
} from "@/lib/llm/types";

/** One-shot structured or free-text generation: brand discovery, briefs, drafts. */
export interface GenerationProvider {
  readonly provider: string;
  readonly model: string;
  generateText(input: GenerateTextInput): Promise<LlmResult<string>>;
  generateJson<T>(input: GenerateJsonInput<T>): Promise<LlmResult<T>>;
}

/**
 * A provider eligible for the repeatable AI-visibility benchmark (Phase 2).
 * Structurally identical to GenerationProvider today — OpenAI's web-search
 * generateText call is a benchmark run. Split into its own type now so a
 * provider that can generate but should never be scored as a benchmark (or
 * vice versa) can implement one without the other once that distinction
 * actually exists.
 */
export type AiBenchmarkProvider = GenerationProvider;
