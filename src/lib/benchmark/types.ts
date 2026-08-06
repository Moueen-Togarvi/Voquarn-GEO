import type {
  BatchStatus,
  RunStatus,
  Sentiment,
} from "@/generated/prisma/enums";

export type AnalysisBatchDto = {
  id: string;
  status: BatchStatus;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  repetitions: number;
  promptSetHash: string;
  extractionVersion: string;
  brandId: string;
  marketId: string;
  operationId: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunAnalysisDto = {
  brandMentioned: boolean;
  mentionCount: number;
  firstMentionCharIndex: number | null;
  position: number | null;
  sentiment: Sentiment;
  refused: boolean;
  confidence: number;
  competitorMentions: Record<string, number>;
};

export type PromptRunDto = {
  id: string;
  provider: string;
  model: string;
  repetitionIndex: number;
  status: RunStatus;
  promptId: string;
  promptText: string;
  errorCode: string | null;
  errorMessage: string | null;
  analysis: RunAnalysisDto | null;
  createdAt: string;
  completedAt: string | null;
};

export type BenchmarkAggregateDto = {
  visibility: number | null;
  shareOfVoice: number | null;
  avgPosition: number | null;
  sentimentDist: Record<string, number>;
  sampleSize: number;
  refusedCount: number;
  failedCount: number;
  computedAt: string;
};

export type BatchSummaryDto = AnalysisBatchDto & {
  aggregate: BenchmarkAggregateDto | null;
};

export type BatchDetailDto = AnalysisBatchDto & {
  runs: PromptRunDto[];
  aggregate: BenchmarkAggregateDto | null;
};
