import OpenAI from "openai";
import { Engine } from "@/lib/types";
import type { AIEngine, EngineResponse } from "@/lib/engines/types";
import { withRetry } from "@/lib/engines/retry";

const MODEL = "gpt-4o";
const apiKey = process.env.OPENAI_API_KEY;

// maxRetries: 0 — our withRetry wrapper owns the retry/timeout policy.
const client = apiKey ? new OpenAI({ apiKey, maxRetries: 0 }) : null;

export const openaiEngine: AIEngine = {
  name: Engine.OPENAI,
  label: "ChatGPT",
  isConfigured: client !== null,

  async runPrompt(prompt: string): Promise<EngineResponse> {
    if (!client) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const start = Date.now();
    const completion = await withRetry("openai", (signal) =>
      client.chat.completions.create(
        {
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
        },
        { signal },
      ),
    );

    return {
      text: completion.choices[0]?.message?.content ?? "",
      sources: [], // OpenAI Chat Completions has no native citations.
      model: completion.model ?? MODEL,
      latencyMs: Date.now() - start,
    };
  },
};
