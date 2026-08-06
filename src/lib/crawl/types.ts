import type {
  CrawlRunStatus,
  KeywordIntent,
  PerformanceSource,
  RenderMode,
} from "@/generated/prisma/enums";

export type CrawlRunDto = {
  id: string;
  host: string;
  status: CrawlRunStatus;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  brandId: string | null;
  competitorId: string | null;
  operationId: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type PageSnapshotDto = {
  id: string;
  url: string;
  canonicalUrl: string | null;
  contentHash: string;
  httpStatus: number;
  renderMode: RenderMode;
  fetchedAt: string;
  crawlRunId: string;
};

export type PageObservationDto = {
  title: string | null;
  description: string | null;
  headings: { level: number; text: string }[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  mediaCounts: { images: number; videos: number; audio: number };
  publishedAt: string | null;
  modifiedAt: string | null;
  freshnessConfidence: number;
  intent: KeywordIntent | null;
};

export type SchemaObservationDto = {
  type: string;
  valid: boolean;
  mismatches: string[];
};

export type PerformanceObservationDto = {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  source: PerformanceSource;
};

export type PageSnapshotDetailDto = PageSnapshotDto & {
  observation: PageObservationDto | null;
  schemas: SchemaObservationDto[];
  performance: PerformanceObservationDto[];
};
