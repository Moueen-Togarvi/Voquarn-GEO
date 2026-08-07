-- Persist the structured first-party profile used to ground competitor
-- discovery and niche-specific AEO/GEO prompt generation.
ALTER TABLE "Brand"
ADD COLUMN "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "audiences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "painPoints" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "contentThemes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "differentiators" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "discoveryPageCount" INTEGER NOT NULL DEFAULT 0;
