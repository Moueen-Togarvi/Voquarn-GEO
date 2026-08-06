import type { KeywordIntent } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
} from "@/lib/embeddings/provider";
import { withGenericProviderCall } from "@/lib/providers/instrument";

/**
 * Topic.embedding and PageObservation.embedding are `Unsupported("vector(1536)")`
 * in schema.prisma, so Prisma's generated Client has no field for them at
 * all — every read and write here goes through $queryRaw/$executeRaw on the
 * plain `db` client. That means scopedDb()'s automatic workspaceId
 * injection does not apply (see the "raw queries are an unscoped escape
 * hatch" note in src/lib/db/scoped.ts) — every query in this file filters
 * by workspaceId explicitly instead.
 */

function toVectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected an embedding of length ${EMBEDDING_DIMENSIONS}, got ${values.length}.`,
    );
  }
  return `[${values.join(",")}]`;
}

async function embedTexts(
  ctx: WorkspaceContext,
  provider: EmbeddingProvider,
  texts: string[],
  operationId?: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { result } = await withGenericProviderCall(
    ctx,
    { capability: "EMBEDDING", provider: provider.provider, operationId },
    () => provider.embed(texts),
  );
  return result;
}

/** Embeds every Topic belonging to brandId that has no embedding yet. Returns how many were embedded. */
export async function ensureTopicEmbeddings(
  ctx: WorkspaceContext,
  input: { brandId: string; provider: EmbeddingProvider; operationId?: string },
): Promise<number> {
  const missing = await db.$queryRaw<{ id: string; name: string }[]>`
    SELECT "id", "name" FROM "Topic"
    WHERE "brandId" = ${input.brandId}
      AND "workspaceId" = ${ctx.workspaceId}
      AND "embedding" IS NULL
  `;
  if (missing.length === 0) return 0;

  const vectors = await embedTexts(
    ctx,
    input.provider,
    missing.map((topic) => topic.name),
    input.operationId,
  );

  let embedded = 0;
  for (let i = 0; i < missing.length; i++) {
    const vector = vectors[i];
    if (!vector || vector.length !== EMBEDDING_DIMENSIONS) continue;
    await db.$executeRaw`
      UPDATE "Topic" SET "embedding" = ${toVectorLiteral(vector)}::vector
      WHERE "id" = ${missing[i]!.id}
    `;
    embedded++;
  }
  return embedded;
}

/** Embeds every PageObservation in one CrawlRun's pages that has no embedding yet, from title+description. */
export async function ensurePageEmbeddings(
  ctx: WorkspaceContext,
  input: {
    crawlRunId: string;
    provider: EmbeddingProvider;
    operationId?: string;
  },
): Promise<number> {
  const missing = await db.$queryRaw<
    { id: string; title: string | null; description: string | null }[]
  >`
    SELECT po."id", po."title", po."description"
    FROM "PageObservation" po
    JOIN "PageSnapshot" ps ON ps."id" = po."snapshotId"
    WHERE ps."crawlRunId" = ${input.crawlRunId}
      AND po."workspaceId" = ${ctx.workspaceId}
      AND po."embedding" IS NULL
  `;
  if (missing.length === 0) return 0;

  const texts = missing.map(
    (row) =>
      [row.title, row.description].filter(Boolean).join(". ") ||
      "(untitled page)",
  );
  const vectors = await embedTexts(
    ctx,
    input.provider,
    texts,
    input.operationId,
  );

  let embedded = 0;
  for (let i = 0; i < missing.length; i++) {
    const vector = vectors[i];
    if (!vector || vector.length !== EMBEDDING_DIMENSIONS) continue;
    await db.$executeRaw`
      UPDATE "PageObservation" SET "embedding" = ${toVectorLiteral(vector)}::vector
      WHERE "id" = ${missing[i]!.id}
    `;
    embedded++;
  }
  return embedded;
}

export type TopicEmbedding = { topicId: string; embeddingLiteral: string };

/** Every embedded Topic for a brand, with its vector already cast to pgvector's text form — reused as a query parameter by findBestPageMatch below, one round-trip instead of one per topic. */
export async function listTopicEmbeddings(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<TopicEmbedding[]> {
  const rows = await db.$queryRaw<{ id: string; embeddingLiteral: string }[]>`
    SELECT "id", "embedding"::text as "embeddingLiteral" FROM "Topic"
    WHERE "brandId" = ${brandId}
      AND "workspaceId" = ${ctx.workspaceId}
      AND "embedding" IS NOT NULL
  `;
  return rows.map((row) => ({
    topicId: row.id,
    embeddingLiteral: row.embeddingLiteral,
  }));
}

export type PageMatch = {
  snapshotId: string;
  url: string;
  title: string | null;
  wordCount: number;
  intent: KeywordIntent | null;
  freshnessConfidence: number;
  publishedAt: string | null;
  modifiedAt: string | null;
  similarity: number;
};

/** The single closest-matching page in one CrawlRun to a topic embedding, or null if nothing clears minSimilarity (or no page in that run has an embedding yet). */
export async function findBestPageMatch(
  ctx: WorkspaceContext,
  input: {
    crawlRunId: string;
    topicEmbeddingLiteral: string;
    minSimilarity: number;
  },
): Promise<PageMatch | null> {
  const rows = await db.$queryRaw<
    {
      snapshotId: string;
      url: string;
      title: string | null;
      wordCount: number;
      intent: string | null;
      freshnessConfidence: number;
      publishedAt: Date | null;
      modifiedAt: Date | null;
      similarity: number;
    }[]
  >`
    SELECT ps."id" as "snapshotId", ps."url", po."title", po."wordCount",
           po."intent", po."freshnessConfidence", po."publishedAt", po."modifiedAt",
           1 - (po."embedding" <=> ${input.topicEmbeddingLiteral}::vector) as similarity
    FROM "PageObservation" po
    JOIN "PageSnapshot" ps ON ps."id" = po."snapshotId"
    WHERE ps."crawlRunId" = ${input.crawlRunId}
      AND po."workspaceId" = ${ctx.workspaceId}
      AND po."embedding" IS NOT NULL
    ORDER BY po."embedding" <=> ${input.topicEmbeddingLiteral}::vector ASC
    LIMIT 1
  `;

  const best = rows[0];
  if (!best || best.similarity < input.minSimilarity) return null;

  return {
    snapshotId: best.snapshotId,
    url: best.url,
    title: best.title,
    wordCount: best.wordCount,
    intent: best.intent as KeywordIntent | null,
    freshnessConfidence: best.freshnessConfidence,
    publishedAt: best.publishedAt ? best.publishedAt.toISOString() : null,
    modifiedAt: best.modifiedAt ? best.modifiedAt.toISOString() : null,
    similarity: best.similarity,
  };
}
