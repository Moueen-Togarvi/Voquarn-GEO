import { Engine } from "@/lib/types";
import type { AIEngine, EngineResponse } from "@/lib/engines/types";
import { withRetry } from "@/lib/engines/retry";

const MODEL = "sonar";
const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const apiKey = process.env.PERPLEXITY_API_KEY;

// Perplexity's response is OpenAI-compatible plus a top-level `citations`
// (and, on newer models, `search_results`) array of real source URLs.
interface PerplexityResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
  citations?: string[];
  search_results?: { url?: string }[];
}

export const perplexityEngine: AIEngine = {
  name: Engine.PERPLEXITY,
  label: "Perplexity",
  isConfigured: apiKey !== undefined && apiKey !== "",

  async runPrompt(prompt: string): Promise<EngineResponse> {
    if (!apiKey) {
      throw new Error("PERPLEXITY_API_KEY is not set");
    }

    const start = Date.now();
    const data = await withRetry<PerplexityResponse>(
      "perplexity",
      async (signal) => {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
          }),
          signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(
            `Perplexity API error ${res.status}: ${body.slice(0, 200)}`,
          );
        }
        return (await res.json()) as PerplexityResponse;
      },
    );

    // Capture real citation URLs — this is what makes Perplexity valuable for
    // GEO. Prefer `citations`; fall back to `search_results[].url`.
    const sources =
      data.citations && data.citations.length > 0
        ? data.citations
        : (data.search_results
            ?.map((r) => r.url)
            .filter((u): u is string => typeof u === "string") ?? []);

    return {
      text: data.choices?.[0]?.message?.content ?? "",
      sources,
      model: data.model ?? MODEL,
      latencyMs: Date.now() - start,
    };
  },
};
