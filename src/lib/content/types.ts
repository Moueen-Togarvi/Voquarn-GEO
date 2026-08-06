import type {
  ApprovalDecision,
  ClaimKind,
  ClaimStatus,
  ContentState,
  RiskCategory,
} from "@/generated/prisma/enums";
import type { BriefEvidenceItem, BriefResult } from "@/lib/content/brief";
import type { ProseMirrorDoc } from "@/lib/content/prosemirror";

export type ContentItemDto = {
  id: string;
  title: string;
  slug: string | null;
  state: ContentState;
  targetWordCount: number | null;
  brandId: string;
  opportunityId: string | null;
  topicId: string | null;
  keywordId: string | null;
  createdAt: string;
  updatedAt: string;
};

// Nullable audience/intent/angle, unlike BriefResult (the LLM's output
// contract, always fully populated) — the DB columns are nullable to leave
// room for a future manually-created packet that skips generation
// entirely, so the DTO reflects the DB's actual guarantee, not the LLM's.
export type ResearchPacketDto = Omit<
  BriefResult,
  "audience" | "intent" | "angle" | "schemaRecommendation"
> & {
  id: string;
  contentItemId: string;
  audience: string | null;
  intent: string | null;
  angle: string | null;
  evidence: BriefEvidenceItem[];
  schemaRecommendation: string | null;
  createdAt: string;
};

export type ContentVersionDto = {
  id: string;
  versionNumber: number;
  doc: ProseMirrorDoc;
  html: string;
  wordCount: number;
  createdBy: string | null;
  parentVersionId: string | null;
  contentItemId: string;
  createdAt: string;
};

export type ClaimDto = {
  id: string;
  text: string;
  kind: ClaimKind;
  status: ClaimStatus;
  riskCategory: RiskCategory | null;
  evidenceLinks: { id: string; url: string | null; note: string | null }[];
};

export type ApprovalDto = {
  id: string;
  decision: ApprovalDecision;
  comment: string | null;
  actorId: string | null;
  decidedAt: string;
};

export type QualityScoreDto = {
  id: string;
  value: number;
  confidence: number;
  components: Record<
    string,
    { weight: number; value: number | null; contribution: number | null }
  >;
  judgeVersion: string;
  computedAt: string;
};

export type ContentItemDetailDto = ContentItemDto & {
  brandName: string;
  researchPacket: ResearchPacketDto | null;
  latestVersion: ContentVersionDto | null;
  claims: ClaimDto[];
  approvals: ApprovalDto[];
  qualityScore: QualityScoreDto | null;
  blockers: { kind: string; message: string; claimId?: string }[];
};
