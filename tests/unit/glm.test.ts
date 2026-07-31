import { describe, expect, it } from "vitest";
import {
  buildGlmRequest,
  DEFAULT_GLM_MODEL,
  GlmProvider,
  ZAI_CHAT_ENDPOINT,
} from "@/lib/llm/glm";

describe("GLM provider foundation", () => {
  it("uses the official GLM-5.1 endpoint and model by default", () => {
    expect(ZAI_CHAT_ENDPOINT).toBe(
      "https://api.z.ai/api/paas/v4/chat/completions",
    );
    expect(DEFAULT_GLM_MODEL).toBe("glm-5.1");
  });

  it("builds web search requests with source results enabled", () => {
    const request = buildGlmRequest({
      messages: [{ role: "user", content: "Best project management tools" }],
      webSearch: true,
    });

    expect(request.model).toBe("glm-5.1");
    expect(request.tools?.[0]).toMatchObject({
      type: "web_search",
      web_search: {
        enable: true,
        search_engine: "search-prime",
        search_result: true,
      },
    });
  });

  it("builds deterministic JSON-mode requests for analysis", () => {
    const request = buildGlmRequest({
      messages: [
        { role: "system", content: "Return JSON." },
        { role: "user", content: "Analyze this." },
      ],
      json: true,
    });

    expect(request.response_format).toEqual({ type: "json_object" });
    expect(request.thinking).toEqual({ type: "disabled" });
    expect(request.temperature).toBe(0.2);
  });

  it("fails before making a network request when no API key is configured", async () => {
    const provider = new GlmProvider(undefined);
    await expect(
      provider.generateText({
        messages: [{ role: "user", content: "This must not be sent." }],
      }),
    ).rejects.toThrow("ZAI_API_KEY is not configured");
  });
});
