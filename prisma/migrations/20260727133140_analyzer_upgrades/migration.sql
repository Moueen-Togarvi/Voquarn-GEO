-- CreateEnum
CREATE TYPE "PromptSource" AS ENUM ('GENERATED', 'AI_SUGGESTED', 'USER');

-- CreateEnum
CREATE TYPE "ScanFrequency" AS ENUM ('OFF', 'WEEKLY', 'DAILY');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('VISIBILITY_DROP', 'SCAN_COMPLETE', 'SCAN_FAILED');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "lastScheduledAt" TIMESTAMP(3),
ADD COLUMN     "scanFrequency" "ScanFrequency" NOT NULL DEFAULT 'OFF';

-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN     "source" "PromptSource" NOT NULL DEFAULT 'GENERATED',
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "volume" INTEGER;

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "rank" INTEGER;

-- CreateTable
CREATE TABLE "PromptSuggestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "volume" INTEGER,
    "reason" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "PromptSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromptSuggestion_brandId_idx" ON "PromptSuggestion"("brandId");

-- CreateIndex
CREATE INDEX "Alert_brandId_read_idx" ON "Alert"("brandId", "read");

-- AddForeignKey
ALTER TABLE "PromptSuggestion" ADD CONSTRAINT "PromptSuggestion_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
