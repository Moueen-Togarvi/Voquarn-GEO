import { NonRetriableError } from "inngest";

import type { WorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { getBrandVoiceProfile } from "@/lib/brands/voice";
import { buildBriefMessages, briefSchema } from "@/lib/content/brief";
import {
  buildClaimExtractionMessages,
  claimExtractionSchema,
} from "@/lib/content/claims";
import { buildSectionMessages, sectionDraftSchema } from "@/lib/content/draft";
import {
  assembleDoc,
  extractPlainText,
  type DraftSection,
} from "@/lib/content/prosemirror";
import {
  createDraftPlaceholderVersion,
  finalizeDraftVersion,
  gatherResearchEvidence,
  getOrCreateQualityScoreDefinitionId,
  persistClaims,
  persistQualityScore,
  persistResearchPacket,
  updateContentItemState,
} from "@/lib/content/service";
import { scopedDb } from "@/lib/db/scoped";
import { chunk } from "@/lib/inngest/chunk";
import { inngest } from "@/lib/inngest/client";
import {
  contentBriefRequested,
  contentDraftRequested,
} from "@/lib/inngest/events";
import { childLogger } from "@/lib/observability/logger";
import {
  advanceOperation,
  completeOperation,
  failOperation,
  startOperation,
} from "@/lib/operations/service";
import { resolveDefault } from "@/lib/llm/registry";
import { generateStructured } from "@/lib/llm/structured";
import { getOpportunity } from "@/lib/opportunity/service";
import { judgeQuality, QUALITY_JUDGE_VERSION } from "@/lib/quality/judge";

const FANOUT_CHUNK_SIZE = 4;

async function loadBrandContext(ctx: WorkspaceContext, contentItemId: string) {
  const item = await scopedDb(ctx).contentItem.findFirstOrThrow({
    where: { id: contentItemId },
  });
  const brand = await getBrand(ctx, item.brandId);
  if (!brand) throw new NonRetriableError(`Brand ${item.brandId} not found`);
  const voice = await getBrandVoiceProfile(ctx, item.brandId);
  const keyword = item.keywordId
    ? await scopedDb(ctx).keyword.findFirst({ where: { id: item.keywordId } })
    : null;

  let opportunitySummary: string | null = null;
  if (item.opportunityId) {
    const opportunity = await getOpportunity(ctx, item.opportunityId);
    opportunitySummary = opportunity?.summary ?? null;
  }

  return {
    item,
    brandName: brand.name,
    brandCategory: brand.category,
    brandTone: voice.tone,
    brandGuidelines: voice.guidelines,
    approvedSamples: voice.approvedSamples,
    keywordText: keyword?.text ?? null,
    opportunitySummary,
  };
}

/**
 * Turns a ContentItem's linked evidence (Phase 4/5 data, never invented)
 * into a structured brief — see the ResearchPacket model comment in
 * schema.prisma for why "the brief" and "the research packet" are the same
 * artifact.
 */
export const contentBrief = inngest.createFunction(
  {
    id: "content-brief",
    triggers: [{ event: contentBriefRequested }],
    concurrency: { key: "event.data.workspaceId", limit: 4 },
    retries: 2,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data;
      const ctx: WorkspaceContext = {
        workspaceId: original.workspaceId,
        userId: null,
        role: "OWNER",
      };
      await updateContentItemState(ctx, original.contentItemId, "FAILED");
      await failOperation(ctx, original.operationId, {
        errorCode: "CONTENT_BRIEF_FAILED",
        errorMessage: error.message,
      });
    },
  },
  async ({ event, step }) => {
    const { workspaceId, contentItemId, operationId } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };

    await step.run("start-operation", () => startOperation(ctx, operationId));
    await step.run("mark-researching", () =>
      updateContentItemState(ctx, contentItemId, "RESEARCHING"),
    );

    const context = await step.run("load-context", () =>
      loadBrandContext(ctx, contentItemId),
    );

    const evidence = await step.run("gather-evidence", () =>
      gatherResearchEvidence(ctx, contentItemId),
    );

    const brief = await step.run("generate-brief", async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new NonRetriableError(
          "Content generation is not configured. Add OPENAI_API_KEY and try again.",
        );
      }

      const provider = resolveDefault("generation");
      const result = await generateStructured(
        ctx,
        { capability: "GENERATION", provider, operationId },
        {
          messages: buildBriefMessages({
            contentTitle: context.item.title,
            brandName: context.brandName,
            brandCategory: context.brandCategory,
            brandTone: context.brandTone,
            keywordText: context.keywordText,
            targetWordCount: context.item.targetWordCount,
            opportunitySummary: context.opportunitySummary,
            evidence: evidence.evidence,
            internalLinkCandidates: evidence.internalLinkCandidates,
          }),
          schema: briefSchema,
          temperature: 0.4,
          maxTokens: 2000,
        },
      );
      return result.content;
    });

    await step.run("persist-brief", () =>
      persistResearchPacket(ctx, {
        contentItemId,
        brief,
        evidence: evidence.evidence,
      }),
    );

    await completeOperation(ctx, operationId);

    return { contentItemId };
  },
);

/**
 * Generates one section at a time through durable, individually-retried
 * steps keyed by versionId (created up front as an empty placeholder —
 * see createDraftPlaceholderVersion) and section index, then assembles them
 * into one ContentVersion. Extracts claims and requests a best-effort
 * quality score once the draft is assembled.
 */
export const contentDraft = inngest.createFunction(
  {
    id: "content-draft",
    triggers: [{ event: contentDraftRequested }],
    concurrency: { key: "event.data.workspaceId", limit: 4 },
    retries: 2,
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data;
      const ctx: WorkspaceContext = {
        workspaceId: original.workspaceId,
        userId: null,
        role: "OWNER",
      };
      await updateContentItemState(ctx, original.contentItemId, "FAILED");
      await failOperation(ctx, original.operationId, {
        errorCode: "CONTENT_DRAFT_FAILED",
        errorMessage: error.message,
      });
    },
  },
  async ({ event, step }) => {
    const { workspaceId, contentItemId, operationId } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };
    const log = childLogger({ contentItemId, workspaceId, fn: "contentDraft" });

    await step.run("start-operation", () => startOperation(ctx, operationId));

    const context = await step.run("load-context", () =>
      loadBrandContext(ctx, contentItemId),
    );

    const packet = await step.run("load-brief", async () => {
      const row = await scopedDb(ctx).researchPacket.findFirst({
        where: { contentItemId },
        orderBy: { createdAt: "desc" },
      });
      if (!row) {
        throw new NonRetriableError(
          "No brief exists for this content item yet — request a brief first.",
        );
      }
      return {
        outline: row.outline as {
          heading: string;
          level: 2 | 3;
          notes: string;
          coverageGoal: string;
        }[],
        evidence: row.evidence as {
          url: string;
          title: string | null;
          snippet: string | null;
        }[],
      };
    });

    const isRevision = context.item.state === "CHANGES_REQUESTED";
    const placeholder = await step.run("create-placeholder-version", () =>
      createDraftPlaceholderVersion(ctx, {
        contentItemId,
        isRevision,
      }),
    );

    if (!process.env.OPENAI_API_KEY) {
      throw new NonRetriableError(
        "Content generation is not configured. Add OPENAI_API_KEY and try again.",
      );
    }

    const sections: DraftSection[] = [];
    let processed = 0;
    for (const group of chunk(packet.outline, FANOUT_CHUNK_SIZE)) {
      const settled = await Promise.allSettled(
        group.map((section, indexInGroup) => {
          const index = processed + indexInGroup;
          return step.run(`section-${placeholder.id}-${index}`, async () => {
            const provider = resolveDefault("generation");
            const result = await generateStructured(
              ctx,
              { capability: "GENERATION", provider, operationId },
              {
                messages: buildSectionMessages({
                  brandName: context.brandName,
                  brandTone: context.brandTone,
                  brandGuidelines: context.brandGuidelines,
                  approvedSamples: context.approvedSamples,
                  contentTitle: context.item.title,
                  sectionHeading: section.heading,
                  sectionNotes: section.notes,
                  coverageGoal: section.coverageGoal,
                  evidence: packet.evidence,
                  precedingHeadings: packet.outline
                    .slice(0, index)
                    .map((s) => s.heading),
                }),
                schema: sectionDraftSchema,
                temperature: 0.6,
                maxTokens: 1200,
              },
            );
            const draftSection: DraftSection = {
              heading: section.heading,
              level: section.level,
              paragraphs: result.content.paragraphs,
            };
            return draftSection;
          });
        }),
      );

      for (const outcome of settled) {
        if (outcome.status === "fulfilled") {
          sections.push(outcome.value);
        } else {
          log.warn(
            { err: String(outcome.reason) },
            "one section failed to generate; continuing with the rest",
          );
        }
      }
      processed += group.length;
      await step.run(`advance-${processed}`, () =>
        advanceOperation(ctx, operationId, {
          progressTotal: packet.outline.length,
          progressCurrent: processed,
        }),
      );
    }

    if (sections.length === 0) {
      throw new Error("No sections were generated successfully.");
    }

    const assembled = assembleDoc(sections);
    const version = await step.run("finalize-version", () =>
      finalizeDraftVersion(ctx, {
        versionId: placeholder.id,
        contentItemId,
        doc: assembled,
      }),
    );

    await step.run("extract-claims", async () => {
      const evidenceUrls = packet.evidence.map((item) => item.url);
      const provider = resolveDefault("generation");
      const result = await generateStructured(
        ctx,
        { capability: "GENERATION", provider, operationId },
        {
          messages: buildClaimExtractionMessages({
            plainText: extractPlainText(assembled),
            evidenceUrls,
          }),
          schema: claimExtractionSchema,
          temperature: 0.1,
          maxTokens: 2000,
        },
      );
      await persistClaims(ctx, {
        versionId: version.id,
        claims: result.content.claims,
      });
    });

    await step.run("judge-quality", async () => {
      const judged = await judgeQuality(ctx, {
        title: context.item.title,
        plainText: extractPlainText(assembled),
        brandName: context.brandName,
        brandTone: context.brandTone,
        outline: packet.outline,
        operationId,
      });
      if (!judged) return;

      const scoreDefinitionId = await getOrCreateQualityScoreDefinitionId();
      await persistQualityScore(ctx, {
        versionId: version.id,
        scoreDefinitionId,
        judgeVersion: QUALITY_JUDGE_VERSION,
        components: {
          intentSatisfaction: judged.intentSatisfaction,
          originalContribution: judged.originalContribution,
          evidenceCoverage: judged.evidenceCoverage,
          completeness: judged.completeness,
          brandFit: judged.brandFit,
          readability: judged.readability,
          internalLinkRelevance: judged.internalLinkRelevance,
          policyCompliance: judged.policyCompliance,
        },
      });
    });

    await completeOperation(ctx, operationId, {
      metadata: { versionId: version.id, sectionsGenerated: sections.length },
    });

    return { versionId: version.id };
  },
);
