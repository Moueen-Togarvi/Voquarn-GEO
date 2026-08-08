-- CreateEnum
CREATE TYPE "CompetitorTier" AS ENUM ('TOP', 'MIDDLE', 'BOTTOM');

-- AlterEnum
ALTER TYPE "OperationKind" ADD VALUE 'COMPETITOR_EXPANSION';

-- DropIndex
DROP INDEX "PageObservation_embedding_idx";

-- DropIndex
DROP INDEX "Topic_embedding_idx";

-- AlterTable
ALTER TABLE "Competitor" ADD COLUMN     "country" TEXT,
ADD COLUMN     "tier" "CompetitorTier";

-- CreateIndex
CREATE INDEX "Competitor_brandId_tier_idx" ON "Competitor"("brandId", "tier");
