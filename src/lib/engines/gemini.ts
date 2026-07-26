import { GoogleGenAI } from "@google/genai";
import { Engine } from "@/lib/types";
import type { AIEngine, EngineResponse } from "@/lib/engines/types";
import { withRetry } from "@/lib/engines/retry";

const MODEL = "gemini-2.0-flash";
const apiKey = process.env.GEMINI_API_KEY;

const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const geminiEngine: AIEngine = {
  name: Engine.GEMINI,
  label: "Gemini",
  isConfigured: client !== null,

  async runPrompt(prompt: string): Promise<EngineResponse> {
    if (!client) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const start = Date.now();
    // The genai SDK doesn't expose a per-call AbortSignal, so the timeout race
    // in withRetry enforces the 30s cap (the call isn't cancelled, just rejected).
    const response = await withRetry("gemini", () =>
      client.models.generateContent({
        model: MODEL,
        contents: prompt,
      }),
    );

    return {
      text: response.text ?? "",
      sources: [], // No native grounding citations without the search tool.
      model: MODEL,
      latencyMs: Date.now() - start,
    };
  },
};
