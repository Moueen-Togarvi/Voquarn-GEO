import type { ZodType } from "zod";

export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmSource = {
  title: string | null;
  url: string;
  snippet: string | null;
  providerRef: string | null;
  publishedAt: string | null;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LlmResult<T> = {
  provider: string;
  model: string;
  /** Null for providers (like GLM today) that do not report a distinct version. */
  providerVersion: string | null;
  requestId: string | null;
  /**
   * Timing and cost are filled in by src/lib/providers/instrument.ts, not by
   * the adapter — it is the one place that measures wall-clock duration and
   * has the pricing table, so every provider populates these identically.
   * An adapter called directly (bypassing withProviderCall) leaves them null.
   */
  requestedAt: string | null;
  completedAt: string | null;
  costUnits: number | null;
  currency: string | null;
  /** Set once a caller has snapshotted the raw response via src/lib/storage/blob.ts. */
  rawSnapshotRef: string | null;
  finishReason: string | null;
  cached: boolean;
  content: T;
  sources: LlmSource[];
  usage: LlmUsage;
};

export type GenerateTextInput = {
  messages: LlmMessage[];
  webSearch?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type GenerateJsonInput<T> = {
  messages: LlmMessage[];
  schema: ZodType<T>;
  webSearch?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export interface LlmProvider {
  readonly provider: string;
  readonly model: string;
  generateText(input: GenerateTextInput): Promise<LlmResult<string>>;
  generateJson<T>(input: GenerateJsonInput<T>): Promise<LlmResult<T>>;
}
