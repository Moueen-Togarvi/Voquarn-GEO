import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ZodError } from "zod";

import {
  StructuredParseError,
  type GenerateJsonInput,
  type GenerateTextInput,
  type LlmMessage,
  type LlmProvider,
  type LlmResult,
  type LlmSource,
} from "@/lib/llm/types";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-sol";

type OpenAiRequestOptions = {
  model?: string;
  messages: LlmMessage[];
  webSearch?: boolean;
  maxTokens?: number;
};

export function buildOpenAiRequest(options: OpenAiRequestOptions) {
  return {
    model: options.model ?? DEFAULT_OPENAI_MODEL,
    input: options.messages,
    max_output_tokens: options.maxTokens ?? 4096,
    reasoning: { effort: "low" as const },
    store: false,
    // Explicit literal `false` (not just omitted) so the SDK's overloaded
    // `responses.create()` resolves to the non-streaming `Response` return
    // type instead of the `Stream<ResponseStreamEvent> | Response` union —
    // an object with no `stream` field at all matches the SDK's most
    // general overload, which returns that union.
    stream: false as const,
    ...(options.webSearch
      ? {
          tools: [{ type: "web_search" as const }],
          include: ["web_search_call.action.sources" as const],
        }
      : {}),
  };
}

// Not `Awaited<ReturnType<...["create"]>>`: TS's ReturnType over an
// overloaded method resolves to the *last* overload signature only, which
// for responses.create() is the general `Stream<ResponseStreamEvent> |
// Response` one — the same union regardless of how the method is actually
// called at any given call site. Reference the SDK's own non-streaming
// response type directly instead.
type OpenAiResponse = OpenAI.Responses.Response;

function sourcesFromResponse(response: OpenAiResponse): LlmSource[] {
  const sources = new Map<string, LlmSource>();
  const add = (
    url: string,
    title: string | null,
    providerRef: string | null,
  ) => {
    if (!url) return;
    const existing = sources.get(url);
    if (existing) {
      if (!existing.title && title) existing.title = title;
      if (!existing.providerRef && providerRef)
        existing.providerRef = providerRef;
      return;
    }
    sources.set(url, {
      title,
      url,
      snippet: null,
      providerRef,
      publishedAt: null,
    });
  };

  for (const item of response.output) {
    if (item.type === "web_search_call") {
      if (item.action.type === "search") {
        for (const source of item.action.sources ?? []) {
          add(source.url, null, item.id);
        }
      } else if (item.action.type === "open_page" && item.action.url) {
        add(item.action.url, null, item.id);
      } else if (item.action.type === "find_in_page" && item.action.url) {
        add(item.action.url, null, item.id);
      }
      continue;
    }

    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const annotation of part.annotations) {
        if (annotation.type === "url_citation") {
          add(annotation.url, annotation.title || null, item.id);
        }
      }
    }
  }

  return [...sources.values()];
}

function refusalFromResponse(response: OpenAiResponse): string | null {
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type === "refusal") return part.refusal;
    }
  }
  return null;
}

function toResult<T>(response: OpenAiResponse, content: T): LlmResult<T> {
  const finishReason =
    response.status === "incomplete"
      ? (response.incomplete_details?.reason ?? "incomplete")
      : (response.status ?? null);

  return {
    provider: "openai",
    model: response.model,
    providerVersion: response.model,
    requestId: response.id,
    requestedAt: null,
    completedAt: null,
    costUnits: null,
    currency: null,
    rawSnapshotRef: null,
    finishReason,
    cached: false,
    content,
    sources: sourcesFromResponse(response),
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
}

/** OpenAI Responses API adapter with native web search and Structured Outputs. */
export class OpenAiProvider implements LlmProvider {
  readonly provider = "openai";
  readonly model: string;
  private readonly client: OpenAI;

  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
  ) {
    this.model = model;
    // Keep construction lazy-friendly even without a configured key. Callers
    // receive our clear configuration error when they actually make a request.
    this.client = new OpenAI({
      apiKey: apiKey ?? "missing-openai-api-key",
      maxRetries: 0,
      timeout: 120_000,
    });
  }

  async generateText(input: GenerateTextInput): Promise<LlmResult<string>> {
    this.assertConfigured();
    const response = await this.client.responses.create(
      buildOpenAiRequest({ ...input, model: this.model }),
    );
    const refusal = refusalFromResponse(response);
    if (refusal) throw new Error(`OpenAI refused the request: ${refusal}`);
    if (!response.output_text) {
      throw new Error(
        `OpenAI returned no text (status: ${response.status ?? "unknown"}).`,
      );
    }
    return toResult(response, response.output_text);
  }

  async generateJson<T>(input: GenerateJsonInput<T>): Promise<LlmResult<T>> {
    this.assertConfigured();
    let response;
    try {
      response = await this.client.responses.parse({
        ...buildOpenAiRequest({
          messages: input.messages,
          model: this.model,
          webSearch: input.webSearch,
          maxTokens: input.maxTokens,
        }),
        text: {
          format: zodTextFormat(input.schema, "structured_response"),
        },
      });
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof ZodError) {
        throw new StructuredParseError(
          `OpenAI structured output could not be parsed: ${error.message}`,
          "",
          { cause: error },
        );
      }
      throw error;
    }
    const refusal = refusalFromResponse(response);
    if (refusal) throw new Error(`OpenAI refused the request: ${refusal}`);
    if (response.output_parsed === null) {
      throw new StructuredParseError(
        `OpenAI returned no parsed structured output (status: ${response.status ?? "unknown"}).`,
        response.output_text,
      );
    }

    // Keep the provider contract's runtime validation even though the API's
    // strict JSON Schema and SDK parser have already checked the same shape.
    const parsed = input.schema.safeParse(response.output_parsed);
    if (!parsed.success) {
      throw new StructuredParseError(
        `Response did not match the expected schema: ${parsed.error.message}`,
        response.output_text,
      );
    }
    return toResult(response, parsed.data);
  }

  private assertConfigured() {
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured. OpenAI calls are disabled until a key is provided.",
      );
    }
  }
}
