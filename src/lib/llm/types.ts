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
  requestId: string | null;
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
  maxTokens?: number;
  temperature?: number;
};

export interface LlmProvider {
  readonly provider: string;
  readonly model: string;
  generateText(input: GenerateTextInput): Promise<LlmResult<string>>;
  generateJson<T>(input: GenerateJsonInput<T>): Promise<LlmResult<T>>;
}
