import Anthropic from "@anthropic-ai/sdk";
import { Engine } from "@/lib/types";
import type { AIEngine, EngineResponse } from "@/lib/engines/types";
import { withRetry } from "@/lib/engines/retry";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;
const apiKey = process.env.ANTHROPIC_API_KEY;

// maxRetries: 0 — our withRetry wrapper owns the retry/timeout policy.
const client = apiKey ? new Anthropic({ apiKey, maxRetries: 0 }) : null;

export const claudeEngine: AIEngine = {
  name: Engine.CLAUDE,
  label: "Claude",
  isConfigured: client !== null,

  async runPrompt(prompt: string): Promise<EngineResponse> {
    if (!client) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    const start = Date.now();
    const message = await withRetry("claude", (signal) =>
      client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [{ role: "user", content: prompt }],
        },
        { signal },
      ),
    );

    // content is a discriminated union — collect the text blocks.
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      sources: [], // The Messages API has no native web citations here.
      model: message.model ?? MODEL,
      latencyMs: Date.now() - start,
    };
  },
};
