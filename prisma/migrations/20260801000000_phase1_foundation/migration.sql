CREATE TYPE "PromptType" AS ENUM ('CATEGORY', 'COMPARISON', 'USE_CASE', 'BRAND_SPECIFIC');
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED');
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Brand" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "websiteUrl" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Competitor" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "websiteUrl" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "brandId" TEXT NOT NULL,
  CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Prompt" (
  "id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "type" "PromptType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "brandId" TEXT NOT NULL,
  CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisBatch" (
  "id" TEXT NOT NULL,
  "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
  "totalRuns" INTEGER NOT NULL DEFAULT 0,
  "completedRuns" INTEGER NOT NULL DEFAULT 0,
  "failedRuns" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "brandId" TEXT NOT NULL,
  CONSTRAINT "AnalysisBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromptRun" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
  "providerRequestId" TEXT,
  "responseText" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "batchId" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  CONSTRAINT "PromptRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RunAnalysis" (
  "id" TEXT NOT NULL,
  "brandMentioned" BOOLEAN NOT NULL,
  "position" INTEGER,
  "sentiment" "Sentiment" NOT NULL,
  "competitorMentions" JSONB NOT NULL,
  "rawResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "promptRunId" TEXT NOT NULL,
  CONSTRAINT "RunAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Source" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "title" TEXT,
  "snippet" TEXT,
  "providerRef" TEXT,
  "citationIndex" INTEGER,
  "isCitation" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "promptRunId" TEXT NOT NULL,
  CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE UNIQUE INDEX "Brand_workspaceId_domain_key" ON "Brand"("workspaceId", "domain");
CREATE INDEX "Brand_workspaceId_updatedAt_idx" ON "Brand"("workspaceId", "updatedAt");
CREATE UNIQUE INDEX "Competitor_brandId_domain_key" ON "Competitor"("brandId", "domain");
CREATE INDEX "Competitor_brandId_idx" ON "Competitor"("brandId");
CREATE UNIQUE INDEX "Prompt_brandId_text_key" ON "Prompt"("brandId", "text");
CREATE INDEX "Prompt_brandId_isActive_idx" ON "Prompt"("brandId", "isActive");
CREATE INDEX "AnalysisBatch_brandId_createdAt_idx" ON "AnalysisBatch"("brandId", "createdAt");
CREATE INDEX "AnalysisBatch_status_idx" ON "AnalysisBatch"("status");
CREATE UNIQUE INDEX "PromptRun_batchId_promptId_provider_model_key" ON "PromptRun"("batchId", "promptId", "provider", "model");
CREATE INDEX "PromptRun_batchId_status_idx" ON "PromptRun"("batchId", "status");
CREATE INDEX "PromptRun_promptId_idx" ON "PromptRun"("promptId");
CREATE UNIQUE INDEX "RunAnalysis_promptRunId_key" ON "RunAnalysis"("promptRunId");
CREATE UNIQUE INDEX "Source_promptRunId_url_key" ON "Source"("promptRunId", "url");
CREATE INDEX "Source_domain_idx" ON "Source"("domain");
CREATE INDEX "Source_promptRunId_idx" ON "Source"("promptRunId");

ALTER TABLE "Brand" ADD CONSTRAINT "Brand_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisBatch" ADD CONSTRAINT "AnalysisBatch_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptRun" ADD CONSTRAINT "PromptRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AnalysisBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromptRun" ADD CONSTRAINT "PromptRun_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RunAnalysis" ADD CONSTRAINT "RunAnalysis_promptRunId_fkey" FOREIGN KEY ("promptRunId") REFERENCES "PromptRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_promptRunId_fkey" FOREIGN KEY ("promptRunId") REFERENCES "PromptRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
