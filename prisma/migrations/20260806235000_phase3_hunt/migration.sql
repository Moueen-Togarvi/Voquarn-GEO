-- Phase 3: HUNT + Search Console.
--
-- Every new table below is brand new (no ALTER on an existing populated
-- table), so there is nothing to backfill.
--
-- pgvector remains deferred to its own Phase-5 migration for the same
-- reason noted in the Phase 2 migration: the CI schema-drift job applies
-- every migration to a stock `postgres:17` container without the extension.

-- CreateEnum
CREATE TYPE "SerpResultType" AS ENUM ('ORGANIC', 'AI_OVERVIEW', 'PAA', 'VIDEO', 'LOCAL');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE_SEARCH_CONSOLE');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "SerpSnapshot" (
    "id" TEXT NOT NULL,
    "device" "MarketDevice" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keywordId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "providerCallId" TEXT,
    "rawSnapshotId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "SerpSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerpResult" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "registrableDomain" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "type" "SerpResultType" NOT NULL DEFAULT 'ORGANIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "SerpResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorObservation" (
    "id" TEXT NOT NULL,
    "candidateDomain" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "competitorId" TEXT,
    "snapshotId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "CompetitorObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "weights" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreatScore" (
    "id" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceCount" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "competitorId" TEXT NOT NULL,
    "scoreDefinitionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ThreatScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "capabilities" JSONB NOT NULL,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptedSecret" (
    "id" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "EncryptedSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "workspaceId" TEXT,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchPerformanceRow" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "SearchPerformanceRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SerpSnapshot_keywordId_marketId_device_fetchedAt_idx" ON "SerpSnapshot"("keywordId", "marketId", "device", "fetchedAt");

-- CreateIndex
CREATE INDEX "SerpSnapshot_workspaceId_idx" ON "SerpSnapshot"("workspaceId");

-- CreateIndex
CREATE INDEX "SerpResult_snapshotId_idx" ON "SerpResult"("snapshotId");

-- CreateIndex
CREATE INDEX "SerpResult_registrableDomain_idx" ON "SerpResult"("registrableDomain");

-- CreateIndex
CREATE INDEX "SerpResult_workspaceId_idx" ON "SerpResult"("workspaceId");

-- CreateIndex
CREATE INDEX "CompetitorObservation_competitorId_idx" ON "CompetitorObservation"("competitorId");

-- CreateIndex
CREATE INDEX "CompetitorObservation_snapshotId_idx" ON "CompetitorObservation"("snapshotId");

-- CreateIndex
CREATE INDEX "CompetitorObservation_keywordId_idx" ON "CompetitorObservation"("keywordId");

-- CreateIndex
CREATE INDEX "CompetitorObservation_workspaceId_idx" ON "CompetitorObservation"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreDefinition_name_version_key" ON "ScoreDefinition"("name", "version");

-- CreateIndex
CREATE INDEX "ThreatScore_competitorId_computedAt_idx" ON "ThreatScore"("competitorId", "computedAt");

-- CreateIndex
CREATE INDEX "ThreatScore_workspaceId_idx" ON "ThreatScore"("workspaceId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_workspaceId_idx" ON "IntegrationConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_siteId_provider_key" ON "IntegrationConnection"("siteId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "EncryptedSecret_connectionId_key" ON "EncryptedSecret"("connectionId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_workspaceId_idx" ON "WebhookDelivery"("workspaceId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_provider_eventType_idx" ON "WebhookDelivery"("provider", "eventType");

-- CreateIndex
CREATE INDEX "SearchPerformanceRow_workspaceId_idx" ON "SearchPerformanceRow"("workspaceId");

-- CreateIndex
CREATE INDEX "SearchPerformanceRow_siteId_date_idx" ON "SearchPerformanceRow"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SearchPerformanceRow_siteId_date_query_page_key" ON "SearchPerformanceRow"("siteId", "date", "query", "page");

-- AddForeignKey
ALTER TABLE "SerpSnapshot" ADD CONSTRAINT "SerpSnapshot_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpSnapshot" ADD CONSTRAINT "SerpSnapshot_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpSnapshot" ADD CONSTRAINT "SerpSnapshot_providerCallId_fkey" FOREIGN KEY ("providerCallId") REFERENCES "ProviderCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpSnapshot" ADD CONSTRAINT "SerpSnapshot_rawSnapshotId_fkey" FOREIGN KEY ("rawSnapshotId") REFERENCES "RawSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpSnapshot" ADD CONSTRAINT "SerpSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpResult" ADD CONSTRAINT "SerpResult_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SerpSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpResult" ADD CONSTRAINT "SerpResult_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorObservation" ADD CONSTRAINT "CompetitorObservation_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorObservation" ADD CONSTRAINT "CompetitorObservation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SerpSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorObservation" ADD CONSTRAINT "CompetitorObservation_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorObservation" ADD CONSTRAINT "CompetitorObservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatScore" ADD CONSTRAINT "ThreatScore_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatScore" ADD CONSTRAINT "ThreatScore_scoreDefinitionId_fkey" FOREIGN KEY ("scoreDefinitionId") REFERENCES "ScoreDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreatScore" ADD CONSTRAINT "ThreatScore_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedSecret" ADD CONSTRAINT "EncryptedSecret_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptedSecret" ADD CONSTRAINT "EncryptedSecret_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformanceRow" ADD CONSTRAINT "SearchPerformanceRow_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformanceRow" ADD CONSTRAINT "SearchPerformanceRow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
