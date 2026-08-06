-- Phase 2: AI visibility measurement.
--
-- Every NOT NULL column added below without a default (Prompt.marketId,
-- AnalysisBatch.marketId/operationId/promptSetHash/extractionVersion,
-- RunAnalysis.extractionVersion) is safe without a backfill step: Prompt,
-- AnalysisBatch, PromptRun, and RunAnalysis have been scaffolded since Phase
-- 1a with zero application code ever writing to them, so all four tables are
-- empty going into this migration.
--
-- pgvector is deliberately NOT enabled here despite the phase plan's "quiet
-- migration" suggestion: the CI schema-drift job (.github/workflows/ci.yml)
-- applies every migration to a stock `postgres:17` container, which does not
-- ship the vector extension, so `CREATE EXTENSION vector` would turn a
-- currently-green CI job red for no benefit today. Phase 5 already owns its
-- own `..._pgvector` migration when the first vector column actually lands —
-- enable it there, against an image/environment that has the extension.

-- CreateEnum
CREATE TYPE "PromptSource" AS ENUM ('AI_GENERATED', 'USER_ADDED');

-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN     "aliasSet" JSONB,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "marketId" TEXT NOT NULL,
ADD COLUMN     "source" "PromptSource" NOT NULL DEFAULT 'AI_GENERATED';

-- AlterTable
ALTER TABLE "AnalysisBatch" ADD COLUMN     "extractionVersion" TEXT NOT NULL,
ADD COLUMN     "marketId" TEXT NOT NULL,
ADD COLUMN     "operationId" TEXT NOT NULL,
ADD COLUMN     "promptSetHash" TEXT NOT NULL,
ADD COLUMN     "repetitions" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "RunAnalysis" ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "extractionVersion" TEXT NOT NULL,
ADD COLUMN     "firstMentionCharIndex" INTEGER,
ADD COLUMN     "mentionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refused" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "sentiment" SET DEFAULT 'NEUTRAL';

-- CreateTable
CREATE TABLE "BenchmarkAggregate" (
    "id" TEXT NOT NULL,
    "visibility" DOUBLE PRECISION,
    "shareOfVoice" DOUBLE PRECISION,
    "avgPosition" DOUBLE PRECISION,
    "sentimentDist" JSONB NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "refusedCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "BenchmarkAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderModelVersion" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecatedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkAggregate_batchId_key" ON "BenchmarkAggregate"("batchId");

-- CreateIndex
CREATE INDEX "BenchmarkAggregate_workspaceId_idx" ON "BenchmarkAggregate"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderModelVersion_provider_model_version_key" ON "ProviderModelVersion"("provider", "model", "version");

-- CreateIndex
CREATE INDEX "Prompt_marketId_idx" ON "Prompt"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisBatch_operationId_key" ON "AnalysisBatch"("operationId");

-- CreateIndex
CREATE INDEX "AnalysisBatch_marketId_idx" ON "AnalysisBatch"("marketId");

-- AddForeignKey
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisBatch" ADD CONSTRAINT "AnalysisBatch_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisBatch" ADD CONSTRAINT "AnalysisBatch_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkAggregate" ADD CONSTRAINT "BenchmarkAggregate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AnalysisBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkAggregate" ADD CONSTRAINT "BenchmarkAggregate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
