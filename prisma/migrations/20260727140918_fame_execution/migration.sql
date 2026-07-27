-- CreateEnum
CREATE TYPE "FameTaskKind" AS ENUM ('PUBLISH_CONTENT', 'ADD_SCHEMA', 'UPDATE_LLMS_TXT', 'SUBMIT_INDEXNOW', 'GET_MENTION');

-- CreateEnum
CREATE TYPE "FameTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('WORDPRESS', 'WEBFLOW', 'GENERIC_WEBHOOK');

-- CreateTable
CREATE TABLE "FameTask" (
    "id" TEXT NOT NULL,
    "kind" "FameTaskKind" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" "FameTaskStatus" NOT NULL DEFAULT 'TODO',
    "payload" JSONB,
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "FameTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "siteUrl" TEXT,
    "credentials" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" TEXT NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FameTask_brandId_idx" ON "FameTask"("brandId");

-- CreateIndex
CREATE INDEX "Integration_brandId_idx" ON "Integration"("brandId");

-- AddForeignKey
ALTER TABLE "FameTask" ADD CONSTRAINT "FameTask_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
