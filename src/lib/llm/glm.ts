import {
  StructuredParseError,
  type GenerateJsonInput,
  type GenerateTextInput,
  type LlmMessage,
  type LlmProvider,
  type LlmResult,
  type LlmSource,
} from "@/lib/llm/types";

export const ZAI_CHAT_ENDPOINT =
  "https://api.z.ai/api/paas/v4/chat/completions";
export const DEFAULT_GLM_MODEL = "glm-5.2";

type GlmRequestOptions = {
  model?: string;
  messages: LlmMessage[];
  webSearch?: boolean;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export function buildGlmRequest(options: GlmRequestOptions) {
  return {
    model: options.model ?? DEFAULT_GLM_MODEL,
    messages: options.messages,
    stream: false,
    thinking: { type: options.json ? "disabled" : "enabled" },
    temperature: options.temperature ?? (options.json ? 0.2 : 1),
    max_tokens: options.maxTokens ?? 4096,
    ...(options.json
      ? { response_format: { type: "json_object" as const } }
      : {}),
    ...(options.webSearch
      ? {
          tools: [
            {
              type: "web_search",
              web_search: {
                enable: true,
                search_engine: "search-prime",
                search_result: true,
                count: 10,
                search_recency_filter: "noLimit",
                content_size: "high",
              },
            },
          ],
        }
      : {}),
  };
}

type GlmApiResponse = {
  request_id?: string;
  id?: string;
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  web_search?: Array<{
    title?: string;
    content?: string;
    link?: string;
    refer?: string;
    publish_date?: string;
  }>;
  code?: number | string;
  message?: string;
  // Z.AI reports failures under `error` (e.g. billing errors arrive as HTTP 429
  // with code 1113), so surface that instead of the bare status text.
  error?: { code?: number | string; message?: string };
};

export class GlmProvider implements LlmProvider {
  readonly provider = "zai";
  readonly model: string;

  constructor(
    private readonly apiKey = process.env.ZAI_API_KEY,
    model = process.env.ZAI_MODEL ?? DEFAULT_GLM_MODEL,
  ) {
    this.model = model;
  }

  async generateText(input: GenerateTextInput): Promise<LlmResult<string>> {
    return this.request(
      buildGlmRequest({
        ...input,
        model: this.model,
      }),
      (content) => content,
    );
  }

  async generateJson<T>(input: GenerateJsonInput<T>): Promise<LlmResult<T>> {
    return this.request(
      buildGlmRequest({
        messages: input.messages,
        model: this.model,
        json: true,
        webSearch: input.webSearch,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
      }),
      (content) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch (error) {
          throw new StructuredParseError(
            `Response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
            content,
          );
        }

        const result = input.schema.safeParse(parsed);
        if (!result.success) {
          throw new StructuredParseError(
            `Response did not match the expected schema: ${result.error.message}`,
            content,
          );
        }
        return result.data;
      },
    );
  }

  private async request<T>(
    body: ReturnType<typeof buildGlmRequest>,
    parse: (content: string) => T,
  ): Promise<LlmResult<T>> {
    if (!this.apiKey) {
      throw new Error(
        "ZAI_API_KEY is not configured. GLM calls are disabled until a key is provided.",
      );
    }

    const response = await fetch(ZAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    const payload = (await response.json()) as GlmApiResponse;
    if (!response.ok) {
      const code = payload.error?.code ?? payload.code ?? response.status;
      const message =
        payload.error?.message ?? payload.message ?? response.statusText;
      throw new Error(`Z.AI request failed (${code}): ${message}`);
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      throw new Error(
        `Z.AI returned no content (finish reason: ${choice?.finish_reason ?? "unknown"}).`,
      );
    }

    const sources: LlmSource[] = (payload.web_search ?? [])
      .filter((source) => Boolean(source.link))
      .map((source) => ({
        title: source.title ?? null,
        url: source.link as string,
        snippet: source.content ?? null,
        providerRef: source.refer ?? null,
        publishedAt: source.publish_date ?? null,
      }));

    return {
      provider: this.provider,
      model: this.model,
      providerVersion: null,
      requestId: payload.request_id ?? payload.id ?? null,
      requestedAt: null,
      completedAt: null,
      costUnits: null,
      currency: null,
      rawSnapshotRef: null,
      finishReason: choice?.finish_reason ?? null,
      cached: false,
      content: parse(content),
      sources,
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? 0,
        outputTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      },
    };
  }
}
