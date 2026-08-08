import {
  benchmarkBatchStart,
  benchmarkRunExecute,
} from "@/lib/inngest/functions/benchmark";
import { brandDiscovery } from "@/lib/inngest/functions/brand-discovery";
import { competitorExpansion } from "@/lib/inngest/functions/competitor-expansion";
import { contentBrief, contentDraft } from "@/lib/inngest/functions/content";
import { crawlPage, crawlRun } from "@/lib/inngest/functions/crawl";
import { gscDailyImport, gscImport } from "@/lib/inngest/functions/gsc";
import {
  huntSerpBatch,
  huntSerpFetch,
  threatScoreCompute,
} from "@/lib/inngest/functions/hunt";
import { opportunityDetect } from "@/lib/inngest/functions/opportunity";
import { promptGeneration } from "@/lib/inngest/functions/prompt-generation";

export const functions = [
  brandDiscovery,
  competitorExpansion,
  promptGeneration,
  benchmarkBatchStart,
  benchmarkRunExecute,
  huntSerpBatch,
  huntSerpFetch,
  threatScoreCompute,
  gscDailyImport,
  gscImport,
  crawlRun,
  crawlPage,
  opportunityDetect,
  contentBrief,
  contentDraft,
];
