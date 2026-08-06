import {
  benchmarkBatchStart,
  benchmarkRunExecute,
} from "@/lib/inngest/functions/benchmark";
import { brandDiscovery } from "@/lib/inngest/functions/brand-discovery";
import { promptGeneration } from "@/lib/inngest/functions/prompt-generation";

export const functions = [
  brandDiscovery,
  promptGeneration,
  benchmarkBatchStart,
  benchmarkRunExecute,
];
