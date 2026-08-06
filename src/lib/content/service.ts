import type {
  Approval,
  Claim,
  ContentItem,
  ContentVersion,
  Prisma,
  QualityScore,
  ResearchPacket,
} from "@/generated/prisma/client";
import type { ApprovalDecision, ContentState } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import { recordAudit } from "@/lib/audit/log";
import { getBrand } from "@/lib/brands/service";
import type { BriefEvidenceItem, BriefResult } from "@/lib/content/brief";
import {
  computeBlockers,
  type Blocker,
  type ClaimWithEvidence,
} from "@/lib/content/blockers";
import type { ClaimCandidate } from "@/lib/content/claims";
import {
  countWords,
  extractPlainText,
  renderToHtml,
  type ProseMirrorDoc,
} from "@/lib/content/prosemirror";
import type {
  ApprovalDto,
  ClaimDto,
  ContentItemDetailDto,
  ContentItemDto,
  ContentVersionDto,
  QualityScoreDto,
  ResearchPacketDto,
} from "@/lib/content/types";
import {
  getLatestCrawlRun,
  listPageSnapshotsForCrawlRun,
} from "@/lib/crawl/service";
import { db } from "@/lib/db";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";
import { getOpportunity } from "@/lib/opportunity/service";
import {
  QUALITY_COMPONENT_WEIGHTS,
  QUALITY_SCORE_NAME,
  QUALITY_SCORE_VERSION,
  computeQualityScore,
  type QualityComponentId,
} from "@/lib/quality/score";
import { assertWithinLimit } from "@/lib/usage/entitlements";

// ProseMirrorNode's recursive `content?: ProseMirrorNode[]` shape doesn't
// structurally satisfy Prisma 7's generated InputJsonValue index-signature
// check even though every value in it is plain JSON — same category of
// mismatch as the Uint8Array<ArrayBuffer> cast needed for EncryptedPayload
// in Phase 3. Safe: a ProseMirrorDoc is always plain JSON-serializable data.
function toJsonDoc(doc: ProseMirrorDoc): Prisma.InputJsonValue {
  return doc as unknown as Prisma.InputJsonValue;
}

// --- DTO mappers ---

function toContentItemDto(item: ContentItem): ContentItemDto {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    state: item.state,
    targetWordCount: item.targetWordCount,
    brandId: item.brandId,
    opportunityId: item.opportunityId,
    topicId: item.topicId,
    keywordId: item.keywordId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toResearchPacketDto(packet: ResearchPacket): ResearchPacketDto {
  return {
    id: packet.id,
    contentItemId: packet.contentItemId,
    audience: packet.audience,
    intent: packet.intent,
    angle: packet.angle,
    outline: packet.outline as BriefResult["outline"],
    evidence: packet.evidence as BriefEvidenceItem[],
    firstPartyInputsNeeded: packet.firstPartyInputsNeeded as string[],
    internalLinkCandidates:
      packet.internalLinkCandidates as BriefResult["internalLinkCandidates"],
    visualSuggestions: packet.visualSuggestions as string[],
    schemaRecommendation: packet.schemaRecommendation,
    createdAt: packet.createdAt.toISOString(),
  };
}

function toContentVersionDto(version: ContentVersion): ContentVersionDto {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    doc: version.doc as ProseMirrorDoc,
    html: version.html,
    wordCount: version.wordCount,
    createdBy: version.createdBy,
    parentVersionId: version.parentVersionId,
    contentItemId: version.contentItemId,
    createdAt: version.createdAt.toISOString(),
  };
}

function toClaimDto(
  claim: Claim & {
    evidenceLinks: { id: string; url: string | null; note: string | null }[];
  },
): ClaimDto {
  return {
    id: claim.id,
    text: claim.text,
    kind: claim.kind,
    status: claim.status,
    riskCategory: claim.riskCategory,
    evidenceLinks: claim.evidenceLinks,
  };
}

function toApprovalDto(approval: Approval): ApprovalDto {
  return {
    id: approval.id,
    decision: approval.decision,
    comment: approval.comment,
    actorId: approval.actorId,
    decidedAt: approval.decidedAt.toISOString(),
  };
}

function toQualityScoreDto(score: QualityScore): QualityScoreDto {
  return {
    id: score.id,
    value: score.value,
    confidence: score.confidence,
    components: score.components as QualityScoreDto["components"],
    judgeVersion: score.judgeVersion,
    computedAt: score.computedAt.toISOString(),
  };
}

// --- ContentItem lifecycle ---

export async function createContentItem(
  ctx: WorkspaceContext,
  input: {
    brandId: string;
    title: string;
    opportunityId?: string;
    targetWordCount?: number;
  },
): Promise<ContentItemDto> {
  assertRole(ctx, "EDITOR");

  const currentCount = await scopedDb(ctx).contentItem.count({
    where: { brandId: input.brandId },
  });
  await assertWithinLimit(ctx, "contentDrafts", currentCount);

  let topicId: string | null = null;
  let keywordId: string | null = null;
  if (input.opportunityId) {
    const opportunity = await getOpportunity(ctx, input.opportunityId);
    topicId = opportunity?.topicId ?? null;
    keywordId = opportunity?.keywordId ?? null;
  }

  const item = await scopedDb(ctx).contentItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      brandId: input.brandId,
      title: input.title,
      targetWordCount: input.targetWordCount ?? null,
      opportunityId: input.opportunityId ?? null,
      topicId,
      keywordId,
    },
  });

  await recordAudit(ctx, {
    action: "content.created",
    targetType: "ContentItem",
    targetId: item.id,
  });

  return toContentItemDto(item);
}

export async function listContentItems(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<ContentItemDto[]> {
  const items = await scopedDb(ctx).contentItem.findMany({
    where: { brandId },
    orderBy: { updatedAt: "desc" },
  });
  return items.map(toContentItemDto);
}

export async function getContentItem(
  ctx: WorkspaceContext,
  contentItemId: string,
): Promise<ContentItemDetailDto | null> {
  const item = await scopedDb(ctx).contentItem.findFirst({
    where: { id: contentItemId },
  });
  if (!item) return null;

  const brand = await getBrand(ctx, item.brandId);

  const [packet, version] = await Promise.all([
    getLatestResearchPacket(ctx, contentItemId),
    getLatestVersion(ctx, contentItemId),
  ]);

  let claims: ClaimDto[] = [];
  let approvals: ApprovalDto[] = [];
  let qualityScore: QualityScoreDto | null = null;
  let blockers: ContentItemDetailDto["blockers"] = [];

  if (version) {
    const [claimRows, approvalRows, scoreRow] = await Promise.all([
      scopedDb(ctx).claim.findMany({
        where: { contentVersionId: version.id },
        include: { evidenceLinks: true },
        orderBy: { createdAt: "asc" },
      }),
      scopedDb(ctx).approval.findMany({
        where: { contentVersionId: version.id },
        orderBy: { decidedAt: "desc" },
      }),
      scopedDb(ctx).qualityScore.findFirst({
        where: { contentVersionId: version.id },
        orderBy: { computedAt: "desc" },
      }),
    ]);

    claims = claimRows.map(toClaimDto);
    approvals = approvalRows.map(toApprovalDto);
    qualityScore = scoreRow ? toQualityScoreDto(scoreRow) : null;

    const claimsWithEvidence: ClaimWithEvidence[] = claimRows.map((claim) => ({
      id: claim.id,
      text: claim.text,
      kind: claim.kind,
      status: claim.status,
      riskCategory: claim.riskCategory,
      hasEvidence: claim.evidenceLinks.length > 0,
    }));
    blockers = computeBlockers({
      text: extractPlainText(version.doc),
      claims: claimsWithEvidence,
    });
  }

  return {
    ...toContentItemDto(item),
    brandName: brand?.name ?? "",
    researchPacket: packet,
    latestVersion: version,
    claims,
    approvals,
    qualityScore,
    blockers,
  };
}

export async function updateContentItemState(
  ctx: WorkspaceContext,
  contentItemId: string,
  state: ContentState,
): Promise<void> {
  await scopedDb(ctx).contentItem.update({
    where: { id: contentItemId },
    data: { state },
  });
}

// --- Research / brief ---

/**
 * Pulls real evidence already collected by earlier phases — never invents
 * any. `evidence` comes from the linked Opportunity's OpportunityEvidence
 * rows (Phase 5: competitor pages, SERP observations, benchmark mentions —
 * exactly what justified detecting this gap in the first place).
 * `internalLinkCandidates` comes from the brand's own latest crawl (Phase
 * 4). A ContentItem with no linked Opportunity gets empty evidence, not an
 * error — manual content planning is still allowed.
 */
export async function gatherResearchEvidence(
  ctx: WorkspaceContext,
  contentItemId: string,
): Promise<{
  evidence: BriefEvidenceItem[];
  internalLinkCandidates: BriefEvidenceItem[];
}> {
  const item = await scopedDb(ctx).contentItem.findFirstOrThrow({
    where: { id: contentItemId },
  });

  let evidence: BriefEvidenceItem[] = [];
  if (item.opportunityId) {
    const opportunity = await getOpportunity(ctx, item.opportunityId);
    evidence = (opportunity?.evidence ?? [])
      .filter((row): row is typeof row & { url: string } => row.url !== null)
      .map((row) => ({ url: row.url, title: null, snippet: row.note }));
  }

  const ownCrawlRun = await getLatestCrawlRun(ctx, { brandId: item.brandId });
  const snapshots = ownCrawlRun
    ? await listPageSnapshotsForCrawlRun(ctx, ownCrawlRun.id)
    : [];
  const internalLinkCandidates: BriefEvidenceItem[] = snapshots
    .slice(0, 20)
    .map((snapshot) => ({
      url: snapshot.url,
      title: snapshot.observation?.title ?? null,
      snippet: null,
    }));

  return { evidence, internalLinkCandidates };
}

export async function getLatestResearchPacket(
  ctx: WorkspaceContext,
  contentItemId: string,
): Promise<ResearchPacketDto | null> {
  const packet = await scopedDb(ctx).researchPacket.findFirst({
    where: { contentItemId },
    orderBy: { createdAt: "desc" },
  });
  return packet ? toResearchPacketDto(packet) : null;
}

/** Append-only — a rerun creates a new packet, never overwrites. Transitions the item into BRIEF_READY. `evidence` is what gatherResearchEvidence() actually fed the brief LLM call — stored so claim extraction and quality judging can reference the same evidence set without re-querying Opportunity/CrawlRun data that may have changed since. */
export async function persistResearchPacket(
  ctx: WorkspaceContext,
  input: {
    contentItemId: string;
    brief: BriefResult;
    evidence: BriefEvidenceItem[];
  },
): Promise<ResearchPacketDto> {
  const packet = await scopedDb(ctx).researchPacket.create({
    data: {
      workspaceId: ctx.workspaceId,
      contentItemId: input.contentItemId,
      audience: input.brief.audience,
      intent: input.brief.intent,
      angle: input.brief.angle,
      outline: input.brief.outline,
      evidence: input.evidence,
      firstPartyInputsNeeded: input.brief.firstPartyInputsNeeded,
      internalLinkCandidates: input.brief.internalLinkCandidates,
      visualSuggestions: input.brief.visualSuggestions,
      schemaRecommendation: input.brief.schemaRecommendation ?? null,
    },
  });

  await updateContentItemState(ctx, input.contentItemId, "BRIEF_READY");

  return toResearchPacketDto(packet);
}

// --- Versions ---

export async function getLatestVersion(
  ctx: WorkspaceContext,
  contentItemId: string,
): Promise<ContentVersionDto | null> {
  const version = await scopedDb(ctx).contentVersion.findFirst({
    where: { contentItemId },
    orderBy: { versionNumber: "desc" },
  });
  return version ? toContentVersionDto(version) : null;
}

async function isVersionApproved(
  ctx: WorkspaceContext,
  versionId: string,
): Promise<boolean> {
  const latestApproval = await scopedDb(ctx).approval.findFirst({
    where: { contentVersionId: versionId },
    orderBy: { decidedAt: "desc" },
  });
  return latestApproval?.decision === "APPROVED";
}

/**
 * Creates an empty version row before section generation starts, so each
 * section's step.run can be keyed `${versionId}:${sectionIndex}` (see
 * contentDraft in src/lib/inngest/functions/content.ts) — Inngest memoizes
 * step results by id, which is what makes "a failed section retry does not
 * duplicate content" true. Handles both the first draft off a BRIEF_READY
 * item and a revision after CHANGES_REQUESTED with the same versionNumber/
 * parentVersionId logic as createRevisionVersion below. finalizeDraftVersion()
 * fills in the real doc once every section has resolved.
 */
export async function createDraftPlaceholderVersion(
  ctx: WorkspaceContext,
  input: { contentItemId: string; isRevision: boolean; createdBy?: string },
): Promise<ContentVersionDto> {
  const latest = await scopedDb(ctx).contentVersion.findFirst({
    where: { contentItemId: input.contentItemId },
    orderBy: { versionNumber: "desc" },
  });

  const empty = { type: "doc" as const, content: [] };
  const version = await scopedDb(ctx).contentVersion.create({
    data: {
      workspaceId: ctx.workspaceId,
      contentItemId: input.contentItemId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      parentVersionId: input.isRevision ? (latest?.id ?? null) : null,
      doc: toJsonDoc(empty),
      html: renderToHtml(empty),
      wordCount: 0,
      createdBy: input.createdBy ?? null,
    },
  });

  await updateContentItemState(ctx, input.contentItemId, "DRAFTING");

  return toContentVersionDto(version);
}

/** Fills in the real content once every section has been generated — see createDraftPlaceholderVersion above. */
export async function finalizeDraftVersion(
  ctx: WorkspaceContext,
  input: { versionId: string; contentItemId: string; doc: ProseMirrorDoc },
): Promise<ContentVersionDto> {
  const version = await scopedDb(ctx).contentVersion.update({
    where: { id: input.versionId },
    data: {
      doc: toJsonDoc(input.doc),
      html: renderToHtml(input.doc),
      wordCount: countWords(input.doc),
    },
  });

  await updateContentItemState(ctx, input.contentItemId, "IN_REVIEW");

  return toContentVersionDto(version);
}

/**
 * Autosave path — mutates the given version's doc/html/wordCount in place.
 * Throws if that version has already been approved: "approved versions are
 * immutable; edits create a new version and invalidate approval" is an
 * acceptance test, not a suggestion. Callers should call
 * createRevisionVersion() instead once they see this throw (the editor UI
 * checks ContentItem.state before ever attempting an autosave on an
 * approved item).
 */
export async function updateDraftContent(
  ctx: WorkspaceContext,
  input: { versionId: string; doc: ProseMirrorDoc },
): Promise<ContentVersionDto> {
  if (await isVersionApproved(ctx, input.versionId)) {
    throw new AppError(
      409,
      "VALIDATION_ERROR",
      "This version is already approved and cannot be edited directly. Create a new revision instead.",
    );
  }

  try {
    const version = await scopedDb(ctx).contentVersion.update({
      where: { id: input.versionId },
      data: {
        doc: toJsonDoc(input.doc),
        html: renderToHtml(input.doc),
        wordCount: countWords(input.doc),
      },
    });
    return toContentVersionDto(version);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(
        404,
        "CONTENT_VERSION_NOT_FOUND",
        "Version not found.",
      );
    }
    throw error;
  }
}

/** Creates version N+1, parented to the current latest version, and moves the item back into DRAFTING — the only path to editing content after it was approved. */
export async function createRevisionVersion(
  ctx: WorkspaceContext,
  input: { contentItemId: string; doc: ProseMirrorDoc; createdBy?: string },
): Promise<ContentVersionDto> {
  const latest = await scopedDb(ctx).contentVersion.findFirst({
    where: { contentItemId: input.contentItemId },
    orderBy: { versionNumber: "desc" },
  });

  const version = await scopedDb(ctx).contentVersion.create({
    data: {
      workspaceId: ctx.workspaceId,
      contentItemId: input.contentItemId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      parentVersionId: latest?.id ?? null,
      doc: toJsonDoc(input.doc),
      html: renderToHtml(input.doc),
      wordCount: countWords(input.doc),
      createdBy: input.createdBy ?? null,
    },
  });

  await updateContentItemState(ctx, input.contentItemId, "DRAFTING");
  await recordAudit(ctx, {
    action: "content.revision_created",
    targetType: "ContentItem",
    targetId: input.contentItemId,
    metadata: { versionId: version.id, versionNumber: version.versionNumber },
  });

  return toContentVersionDto(version);
}

// --- Claims ---

/** Persists LLM-proposed claims (src/lib/content/claims.ts) as Claim + EvidenceLink rows. status is derived deterministically here, never trusted from the LLM. */
export async function persistClaims(
  ctx: WorkspaceContext,
  input: { versionId: string; claims: ClaimCandidate[] },
): Promise<ClaimDto[]> {
  const created: ClaimDto[] = [];

  for (const candidate of input.claims) {
    const status = candidate.riskCategory
      ? "RISKY"
      : candidate.kind !== "FACTUAL" || candidate.evidenceUrl
        ? "RESOLVED"
        : "UNRESOLVED";

    const claim = await scopedDb(ctx).claim.create({
      data: {
        workspaceId: ctx.workspaceId,
        contentVersionId: input.versionId,
        text: candidate.text,
        kind: candidate.kind,
        status,
        riskCategory: candidate.riskCategory,
        evidenceLinks: candidate.evidenceUrl
          ? {
              create: [
                {
                  workspaceId: ctx.workspaceId,
                  url: candidate.evidenceUrl,
                },
              ],
            }
          : undefined,
      },
      include: { evidenceLinks: true },
    });

    created.push(toClaimDto(claim));
  }

  return created;
}

export async function computeVersionBlockers(
  ctx: WorkspaceContext,
  versionId: string,
): Promise<Blocker[]> {
  const version = await scopedDb(ctx).contentVersion.findFirstOrThrow({
    where: { id: versionId },
  });
  const claims = await scopedDb(ctx).claim.findMany({
    where: { contentVersionId: versionId },
    include: { evidenceLinks: true },
  });

  return computeBlockers({
    text: extractPlainText(version.doc as ProseMirrorDoc),
    claims: claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      kind: claim.kind,
      status: claim.status,
      riskCategory: claim.riskCategory,
      hasEvidence: claim.evidenceLinks.length > 0,
    })),
  });
}

// --- Approval ---

/**
 * Enforces the hard gate: an APPROVED decision is refused (422
 * CONTENT_BLOCKED) while any blocker remains — unresolved placeholders,
 * unsourced factual claims, risky claims, invented quotes. A
 * CHANGES_REQUESTED decision is always allowed regardless of blockers,
 * since flagging problems is the whole point of that path.
 */
export async function recordApproval(
  ctx: WorkspaceContext,
  input: {
    versionId: string;
    contentItemId: string;
    decision: ApprovalDecision;
    comment?: string;
    actorId?: string;
  },
): Promise<ApprovalDto> {
  assertRole(ctx, "EDITOR");

  if (input.decision === "APPROVED") {
    const blockers = await computeVersionBlockers(ctx, input.versionId);
    if (blockers.length > 0) {
      throw new AppError(
        422,
        "CONTENT_BLOCKED",
        `This version cannot be approved: ${blockers.map((b) => b.message).join("; ")}`,
      );
    }
  }

  const approval = await scopedDb(ctx).approval.create({
    data: {
      workspaceId: ctx.workspaceId,
      contentVersionId: input.versionId,
      decision: input.decision,
      comment: input.comment ?? null,
      actorId: input.actorId ?? null,
    },
  });

  await updateContentItemState(
    ctx,
    input.contentItemId,
    input.decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED",
  );

  await recordAudit(ctx, {
    action: `content.${input.decision.toLowerCase()}`,
    targetType: "ContentVersion",
    targetId: input.versionId,
    metadata: { comment: input.comment },
  });

  return toApprovalDto(approval);
}

// --- Quality score ---

export async function getOrCreateQualityScoreDefinitionId(): Promise<string> {
  const existing = await db.scoreDefinition.findUnique({
    where: {
      name_version: {
        name: QUALITY_SCORE_NAME,
        version: QUALITY_SCORE_VERSION,
      },
    },
  });
  if (existing) return existing.id;

  const created = await db.scoreDefinition.create({
    data: {
      name: QUALITY_SCORE_NAME,
      version: QUALITY_SCORE_VERSION,
      weights: QUALITY_COMPONENT_WEIGHTS,
    },
  });
  return created.id;
}

export async function persistQualityScore(
  ctx: WorkspaceContext,
  input: {
    versionId: string;
    scoreDefinitionId: string;
    judgeVersion: string;
    components: Partial<Record<QualityComponentId, number | null>>;
  },
): Promise<QualityScoreDto> {
  const result = computeQualityScore(input.components);

  const score = await scopedDb(ctx).qualityScore.create({
    data: {
      workspaceId: ctx.workspaceId,
      contentVersionId: input.versionId,
      scoreDefinitionId: input.scoreDefinitionId,
      judgeVersion: input.judgeVersion,
      value: result.value,
      confidence: result.confidence,
      components: result.components,
    },
  });

  return toQualityScoreDto(score);
}
