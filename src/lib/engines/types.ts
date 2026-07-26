import type { Engine } from "@/lib/types";

/** Normalized response returned by every engine adapter. */
export interface EngineResponse {
  /** The assistant's answer text. */
  text: string;
  /** Real source URLs cited by the engine (only Perplexity returns these). */
  sources: string[];
  /** The concrete model string that produced the answer. */
  model: string;
  /** Wall-clock latency of the successful call, in milliseconds. */
  latencyMs: number;
}

/** A single AI engine the platform can query. */
export interface AIEngine {
  /** Stable identifier matching the Prisma `Engine` enum. */
  readonly name: Engine;
  /** Human-facing label (e.g. "ChatGPT"). */
  readonly label: string;
  /** True when the required API key is present; false engines are skipped. */
  readonly isConfigured: boolean;
  /** Run a single prompt and return a normalized response. */
  runPrompt(prompt: string): Promise<EngineResponse>;
}
