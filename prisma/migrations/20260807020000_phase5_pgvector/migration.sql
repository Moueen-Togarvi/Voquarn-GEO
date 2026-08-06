-- Phase 5: pgvector.
--
-- Deferred here from Phase 2 (where it was first mentioned as a "quiet,
-- unused" migration) all the way through Phase 4, each time for the same
-- reason: the CI schema-drift job (.github/workflows/ci.yml, `schema` job)
-- replays every migration against a real Postgres container, and a stock
-- `postgres:17` image has no `vector` extension available to install. That
-- job's image is switched to `pgvector/pgvector:pg17` alongside this
-- migration landing — see the comment there.
--
-- Topic.embedding and PageObservation.embedding are `Unsupported("vector(1536)")`
-- in schema.prisma, so Prisma's generated Client never sees these columns —
-- all reads and writes go through raw SQL in src/lib/embeddings/service.ts.
-- HNSW (not IVFFlat) because the corpus per workspace is small — hundreds to
-- low thousands of topics/pages, not millions — and HNSW needs no training
-- step, so it is queryable correctly even with a handful of rows, which
-- IVFFlat's list-based index is not. Vector columns are nullable and HNSW
-- happily indexes a table that is still mostly NULL while embeddings
-- backfill.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN "embedding" vector(1536);

-- AlterTable
ALTER TABLE "PageObservation" ADD COLUMN "embedding" vector(1536);

-- CreateIndex
CREATE INDEX "Topic_embedding_idx" ON "Topic" USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex
CREATE INDEX "PageObservation_embedding_idx" ON "PageObservation" USING hnsw ("embedding" vector_cosine_ops);
