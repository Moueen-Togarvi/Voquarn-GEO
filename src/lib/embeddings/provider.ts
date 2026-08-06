/**
 * Same posture as every other external adapter in this codebase (GLM,
 * DataForSEO, Google Search Console, Browserless, CrUX): structurally
 * complete against the provider's documented API, but never exercised
 * against a live embeddings endpoint in this environment — verify before
 * relying on it in production. Gated on ZAI_API_KEY, mirroring
 * src/lib/llm/glm.ts, and throws a clear configuration error when absent
 * rather than silently returning empty vectors.
 */

export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingProvider {
  readonly provider: string;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

const ZAI_EMBEDDINGS_ENDPOINT = "https://api.z.ai/api/paas/v4/embeddings";
export const DEFAULT_ZAI_EMBEDDING_MODEL = "embedding-3";

type ZaiEmbeddingResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  code?: number | string;
  message?: string;
  error?: { code?: number | string; message?: string };
};

export class GlmEmbeddingProvider implements EmbeddingProvider {
  readonly provider = "zai";
  readonly model: string;

  constructor(
    private readonly apiKey = process.env.ZAI_API_KEY,
    model = process.env.ZAI_EMBEDDING_MODEL ?? DEFAULT_ZAI_EMBEDDING_MODEL,
  ) {
    this.model = model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error(
        "ZAI_API_KEY is not configured. Embedding calls are disabled until a key is provided.",
      );
    }
    if (texts.length === 0) return [];

    const response = await fetch(ZAI_EMBEDDINGS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: texts }),
      signal: AbortSignal.timeout(60_000),
    });

    const payload = (await response.json()) as ZaiEmbeddingResponse;
    if (!response.ok) {
      const code = payload.error?.code ?? payload.code ?? response.status;
      const message =
        payload.error?.message ?? payload.message ?? response.statusText;
      throw new Error(`Z.AI embeddings request failed (${code}): ${message}`);
    }

    const rows = payload.data ?? [];
    // Defensive against a provider that doesn't preserve input order —
    // sort by the returned index rather than trusting array position.
    const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return sorted.map((row) => row.embedding ?? []);
  }
}
