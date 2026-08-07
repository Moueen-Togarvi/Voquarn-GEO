import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildOpenAiRequest,
  DEFAULT_OPENAI_MODEL,
  OpenAiProvider,
} from "@/lib/llm/openai";
import { StructuredParseError } from "@/lib/llm/types";

function responseBody(text: string) {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1,
    completed_at: 2,
    status: "completed",
    model: "gpt-5.6-sol",
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: {},
    output: [
      {
        id: "ws_test",
        type: "web_search_call",
        status: "completed",
        action: {
          type: "search",
          queries: ["GEO software competitors"],
          sources: [{ type: "url", url: "https://example.com/research" }],
        },
      },
      {
        id: "msg_test",
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text,
            annotations: [
              {
                type: "url_citation",
                start_index: 0,
                end_index: 3,
                title: "Research source",
                url: "https://example.com/research",
              },
            ],
          },
        ],
      },
    ],
    parallel_tool_calls: true,
    temperature: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    usage: {
      input_tokens: 5,
      output_tokens: 3,
      total_tokens: 8,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  };
}

describe("OpenAI provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the current flagship model by default", () => {
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-5.6-sol");
  });

  it("builds Responses API requests with native web search and sources", () => {
    const request = buildOpenAiRequest({
      messages: [{ role: "user", content: "Best project management tools" }],
      webSearch: true,
    });

    expect(request).toMatchObject({
      model: "gpt-5.6-sol",
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      reasoning: { effort: "low" },
      store: false,
    });
  });

  it("fails before making a network request when no API key is configured", async () => {
    const provider = new OpenAiProvider(undefined);
    await expect(
      provider.generateText({
        messages: [{ role: "user", content: "This must not be sent." }],
      }),
    ).rejects.toThrow("OPENAI_API_KEY is not configured");
  });

  it("uses Structured Outputs, parses content, usage, and citations", async () => {
    let sentBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify(responseBody('{"category":"GEO"}')),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const provider = new OpenAiProvider("test-key");
    const result = await provider.generateJson({
      messages: [{ role: "user", content: "Research this company." }],
      schema: z.object({ category: z.string() }),
      webSearch: true,
    });

    expect(sentBody?.tools).toEqual([{ type: "web_search" }]);
    expect(sentBody?.text).toMatchObject({
      format: {
        type: "json_schema",
        name: "structured_response",
        strict: true,
      },
    });
    expect(result.content.category).toBe("GEO");
    expect(result.usage.totalTokens).toBe(8);
    expect(result.sources).toEqual([
      expect.objectContaining({
        url: "https://example.com/research",
        title: "Research source",
      }),
    ]);
  });

  it("normalizes SDK schema parse failures into StructuredParseError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(responseBody('{"wrongField":123}')), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const provider = new OpenAiProvider("test-key");
    await expect(
      provider.generateJson({
        messages: [{ role: "user", content: "Research this company." }],
        schema: z.object({ category: z.string() }),
      }),
    ).rejects.toBeInstanceOf(StructuredParseError);
  });
});
