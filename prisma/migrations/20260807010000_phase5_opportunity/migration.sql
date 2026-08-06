-- Phase 5: GAP ATTACK (opportunity detection).
--
-- Every table below is brand new — nothing to backfill. ProviderCapability
-- gets one new value (EMBEDDING) for the Phase-5 embeddings provider; adding
-- an enum value is safe outside the same transaction that would reference
-- it, and nothing here does.
--
-- pgvector itself (the Topic/PageObservation embedding columns) is its own
-- migration, right after this one, so a failure enabling the extension never
-- leaves the plain relational tables half-created.

-- CreateEnum
CREATE TYPE "OpportunityKind" AS ENUM ('MISSING_COVERAGE', 'WEAK_COVERAGE', 'STALE', 'INTENT_MISMATCH', 'COMPARISON', 'CITATION_GAP');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('NEW', 'ACCEPTED', 'DEFERRED', 'DISMISSED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OpportunityEvidenceKind" AS ENUM ('OWN_PAGE', 'COMPETITOR_PAGE', 'SERP_OBSERVATION', 'BENCHMARK_MENTION', 'KEYWORD');

-- AlterEnum
ALTER TYPE "ProviderCapability" ADD VALUE 'EMBEDDING';

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "kind" "OpportunityKind" NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'NEW',
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedActions" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT NOT NULL,
    "competitorId" TEXT,
    "topicId" TEXT,
    "keywordId" TEXT,
    "scoreDefinitionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityEvidence" (
    "id" TEXT NOT NULL,
    "kind" "OpportunityEvidenceKind" NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opportunityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "OpportunityEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityDecision" (
    "id" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opportunityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "OpportunityDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConquestPlan" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brandId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ConquestPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "planId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_brandId_dedupeKey_key" ON "Opportunity"("brandId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Opportunity_brandId_status_score_idx" ON "Opportunity"("brandId", "status", "score");

-- CreateIndex
CREATE INDEX "Opportunity_workspaceId_idx" ON "Opportunity"("workspaceId");

-- CreateIndex
CREATE INDEX "OpportunityEvidence_opportunityId_idx" ON "OpportunityEvidence"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityEvidence_workspaceId_idx" ON "OpportunityEvidence"("workspaceId");

-- CreateIndex
CREATE INDEX "OpportunityDecision_opportunityId_idx" ON "OpportunityDecision"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityDecision_workspaceId_idx" ON "OpportunityDecision"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ConquestPlan_brandId_weekStart_key" ON "ConquestPlan"("brandId", "weekStart");

-- CreateIndex
CREATE INDEX "ConquestPlan_workspaceId_idx" ON "ConquestPlan"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_planId_opportunityId_key" ON "PlanItem"("planId", "opportunityId");

-- CreateIndex
CREATE INDEX "PlanItem_workspaceId_idx" ON "PlanItem"("workspaceId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_scoreDefinitionId_fkey" FOREIGN KEY ("scoreDefinitionId") REFERENCES "ScoreDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEvidence" ADD CONSTRAINT "OpportunityEvidence_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEvidence" ADD CONSTRAINT "OpportunityEvidence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityDecision" ADD CONSTRAINT "OpportunityDecision_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityDecision" ADD CONSTRAINT "OpportunityDecision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquestPlan" ADD CONSTRAINT "ConquestPlan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConquestPlan" ADD CONSTRAINT "ConquestPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ConquestPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
