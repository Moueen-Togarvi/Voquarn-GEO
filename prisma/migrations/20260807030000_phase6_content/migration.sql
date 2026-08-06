-- Phase 6: AUTO-BUILD (evidence-backed brief and draft).
--
-- Every new table below is brand new. BrandVoiceProfile gets one new
-- nullable column (approvedSamples) — additive, no backfill needed.

-- CreateEnum
CREATE TYPE "ContentState" AS ENUM ('PLANNED', 'RESEARCHING', 'BRIEF_READY', 'DRAFTING', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHING', 'PUBLISHED', 'MONITORING', 'CANCELLED', 'FAILED', 'ARCHIVED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ClaimKind" AS ENUM ('FACTUAL', 'OPINION', 'FIRST_PARTY');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNRESOLVED', 'RESOLVED', 'RISKY');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('MEDICAL', 'LEGAL', 'FINANCIAL');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- AlterTable
ALTER TABLE "BrandVoiceProfile" ADD COLUMN "approvedSamples" JSONB;

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "state" "ContentState" NOT NULL DEFAULT 'PLANNED',
    "targetWordCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "topicId" TEXT,
    "keywordId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchPacket" (
    "id" TEXT NOT NULL,
    "audience" TEXT,
    "intent" TEXT,
    "angle" TEXT,
    "outline" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "firstPartyInputsNeeded" JSONB NOT NULL,
    "internalLinkCandidates" JSONB NOT NULL,
    "visualSuggestions" JSONB NOT NULL,
    "schemaRecommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentItemId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ResearchPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "doc" JSONB NOT NULL,
    "html" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentItemId" TEXT NOT NULL,
    "parentVersionId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" "ClaimKind" NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "riskCategory" "RiskCategory",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentVersionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,
    "sourceTable" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "actorId" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentVersionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityScore" (
    "id" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "judgeVersion" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentVersionId" TEXT NOT NULL,
    "scoreDefinitionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "QualityScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentItem_brandId_state_idx" ON "ContentItem"("brandId", "state");

-- CreateIndex
CREATE INDEX "ContentItem_opportunityId_idx" ON "ContentItem"("opportunityId");

-- CreateIndex
CREATE INDEX "ContentItem_workspaceId_idx" ON "ContentItem"("workspaceId");

-- CreateIndex
CREATE INDEX "ResearchPacket_contentItemId_createdAt_idx" ON "ResearchPacket"("contentItemId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchPacket_workspaceId_idx" ON "ResearchPacket"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentVersion_contentItemId_versionNumber_key" ON "ContentVersion"("contentItemId", "versionNumber");

-- CreateIndex
CREATE INDEX "ContentVersion_workspaceId_idx" ON "ContentVersion"("workspaceId");

-- CreateIndex
CREATE INDEX "Claim_contentVersionId_idx" ON "Claim"("contentVersionId");

-- CreateIndex
CREATE INDEX "Claim_workspaceId_idx" ON "Claim"("workspaceId");

-- CreateIndex
CREATE INDEX "EvidenceLink_claimId_idx" ON "EvidenceLink"("claimId");

-- CreateIndex
CREATE INDEX "EvidenceLink_workspaceId_idx" ON "EvidenceLink"("workspaceId");

-- CreateIndex
CREATE INDEX "Approval_contentVersionId_idx" ON "Approval"("contentVersionId");

-- CreateIndex
CREATE INDEX "Approval_workspaceId_idx" ON "Approval"("workspaceId");

-- CreateIndex
CREATE INDEX "QualityScore_contentVersionId_idx" ON "QualityScore"("contentVersionId");

-- CreateIndex
CREATE INDEX "QualityScore_workspaceId_idx" ON "QualityScore"("workspaceId");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchPacket" ADD CONSTRAINT "ResearchPacket_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchPacket" ADD CONSTRAINT "ResearchPacket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "ContentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityScore" ADD CONSTRAINT "QualityScore_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityScore" ADD CONSTRAINT "QualityScore_scoreDefinitionId_fkey" FOREIGN KEY ("scoreDefinitionId") REFERENCES "ScoreDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityScore" ADD CONSTRAINT "QualityScore_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
