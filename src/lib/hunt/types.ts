import type { CompetitorStatus, MarketDevice } from "@/generated/prisma/enums";
import type {
  ThreatComponentBreakdown,
  ThreatComponentId,
} from "@/lib/scoring/threat-v1";

export type SerpSnapshotDto = {
  id: string;
  keywordId: string;
  marketId: string;
  device: MarketDevice;
  fetchedAt: string;
  resultCount: number;
};

export type ThreatScoreDto = {
  id: string;
  value: number;
  confidence: number;
  evidenceCount: number;
  components: Record<ThreatComponentId, ThreatComponentBreakdown>;
  computedAt: string;
};

export type CompetitorWithScoreDto = {
  id: string;
  name: string;
  websiteUrl: string;
  domain: string;
  status: CompetitorStatus;
  latestScore: ThreatScoreDto | null;
};

export type CompetitorObservationSummaryDto = {
  keywordId: string;
  keywordText: string;
  position: number;
  snapshotFetchedAt: string;
};

export type CompetitorEvidenceDto = {
  competitor: {
    id: string;
    name: string;
    websiteUrl: string;
    domain: string;
    status: CompetitorStatus;
  };
  latestScore: ThreatScoreDto | null;
  scoreHistory: ThreatScoreDto[];
  observations: CompetitorObservationSummaryDto[];
};

export type TrackedKeywordDto = {
  keywordId: string;
  text: string;
  marketId: string;
};
