-- Phase 4: AUTOPSY (crawl infrastructure).
--
-- Every table below is brand new — nothing to backfill.
--
-- pgvector remains deferred to its own Phase-5 migration, same reason noted
-- in the Phase 2 and Phase 3 migrations.

-- CreateEnum
CREATE TYPE "CrawlRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED');

-- CreateEnum
CREATE TYPE "RenderMode" AS ENUM ('STATIC', 'BROWSER');

-- CreateEnum
CREATE TYPE "PerformanceSource" AS ENUM ('FIELD', 'LAB');

-- CreateTable
CREATE TABLE "CrawlRun" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "status" "CrawlRunStatus" NOT NULL DEFAULT 'PENDING',
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "completedPages" INTEGER NOT NULL DEFAULT 0,
    "failedPages" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT,
    "competitorId" TEXT,
    "operationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageSnapshot" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "contentHash" TEXT NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "renderMode" "RenderMode" NOT NULL DEFAULT 'STATIC',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "crawlRunId" TEXT NOT NULL,
    "rawSnapshotId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "PageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageObservation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "headings" JSONB NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "internalLinks" INTEGER NOT NULL,
    "externalLinks" INTEGER NOT NULL,
    "mediaCounts" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "modifiedAt" TIMESTAMP(3),
    "freshnessConfidence" DOUBLE PRECISION NOT NULL,
    "intent" "KeywordIntent",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "PageObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaObservation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "mismatches" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "SchemaObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceObservation" (
    "id" TEXT NOT NULL,
    "lcp" DOUBLE PRECISION,
    "inp" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "source" "PerformanceSource" NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "PerformanceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RobotsCache" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RobotsCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCrawlerAccess" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "botName" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" TEXT NOT NULL,

    CONSTRAINT "AiCrawlerAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrawlRun_operationId_key" ON "CrawlRun"("operationId");

-- CreateIndex
CREATE INDEX "CrawlRun_workspaceId_createdAt_idx" ON "CrawlRun"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CrawlRun_brandId_idx" ON "CrawlRun"("brandId");

-- CreateIndex
CREATE INDEX "CrawlRun_competitorId_idx" ON "CrawlRun"("competitorId");

-- CreateIndex
CREATE INDEX "PageSnapshot_crawlRunId_idx" ON "PageSnapshot"("crawlRunId");

-- CreateIndex
CREATE INDEX "PageSnapshot_url_idx" ON "PageSnapshot"("url");

-- CreateIndex
CREATE INDEX "PageSnapshot_workspaceId_idx" ON "PageSnapshot"("workspaceId");

-- CreateIndex
CREATE INDEX "PageSnapshot_contentHash_idx" ON "PageSnapshot"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "PageObservation_snapshotId_key" ON "PageObservation"("snapshotId");

-- CreateIndex
CREATE INDEX "PageObservation_workspaceId_idx" ON "PageObservation"("workspaceId");

-- CreateIndex
CREATE INDEX "SchemaObservation_snapshotId_idx" ON "SchemaObservation"("snapshotId");

-- CreateIndex
CREATE INDEX "SchemaObservation_workspaceId_idx" ON "SchemaObservation"("workspaceId");

-- CreateIndex
CREATE INDEX "PerformanceObservation_snapshotId_idx" ON "PerformanceObservation"("snapshotId");

-- CreateIndex
CREATE INDEX "PerformanceObservation_workspaceId_idx" ON "PerformanceObservation"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "RobotsCache_host_key" ON "RobotsCache"("host");

-- CreateIndex
CREATE UNIQUE INDEX "AiCrawlerAccess_domain_botName_key" ON "AiCrawlerAccess"("domain", "botName");

-- AddForeignKey
ALTER TABLE "CrawlRun" ADD CONSTRAINT "CrawlRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlRun" ADD CONSTRAINT "CrawlRun_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlRun" ADD CONSTRAINT "CrawlRun_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlRun" ADD CONSTRAINT "CrawlRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSnapshot" ADD CONSTRAINT "PageSnapshot_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSnapshot" ADD CONSTRAINT "PageSnapshot_rawSnapshotId_fkey" FOREIGN KEY ("rawSnapshotId") REFERENCES "RawSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageSnapshot" ADD CONSTRAINT "PageSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageObservation" ADD CONSTRAINT "PageObservation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PageSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageObservation" ADD CONSTRAINT "PageObservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaObservation" ADD CONSTRAINT "SchemaObservation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PageSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaObservation" ADD CONSTRAINT "SchemaObservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceObservation" ADD CONSTRAINT "PerformanceObservation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PageSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceObservation" ADD CONSTRAINT "PerformanceObservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
