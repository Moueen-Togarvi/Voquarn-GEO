import OpenAI from "openai";

export const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingProvider {
  readonly provider: string;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly provider = "openai";
  readonly model: string;
  private readonly client: OpenAI;

  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_EMBEDDING_MODEL ??
      DEFAULT_OPENAI_EMBEDDING_MODEL,
  ) {
    this.model = model;
    this.client = new OpenAI({
      apiKey: apiKey ?? "missing-openai-api-key",
      maxRetries: 0,
      timeout: 60_000,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured. Embedding calls are disabled until a key is provided.",
      );
    }
    if (texts.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    });
    // Defensive against a provider that doesn't preserve input order —
    // sort by the returned index rather than trusting array position.
    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    return sorted.map((row) => row.embedding);
  }
}
