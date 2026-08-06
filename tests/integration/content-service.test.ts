import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WorkspaceContext } from "@/lib/auth/context";
import type { BriefResult } from "@/lib/content/brief";
import type { ClaimCandidate } from "@/lib/content/claims";
import type { ProseMirrorDoc } from "@/lib/content/prosemirror";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasTestDatabase)("content service", () => {
  let brandService: typeof import("@/lib/brands/service");
  let contentService: typeof import("@/lib/content/service");
  let database: (typeof import("@/lib/db"))["db"];
  let ctx: WorkspaceContext;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    brandService = await import("@/lib/brands/service");
    contentService = await import("@/lib/content/service");
    database = (await import("@/lib/db")).db;

    const workspace = await database.workspace.create({
      data: {
        name: `Content Service Test ${suffix}`,
        slug: `content-service-test-${suffix}`,
      },
    });
    ctx = { workspaceId: workspace.id, userId: null, role: "OWNER" };
  });

  afterAll(async () => {
    await database.brand.deleteMany({
      where: { domain: { endsWith: `.test` } },
    });
    await database.scoreDefinition.deleteMany({
      where: { name: "quality-v1" },
    });
    await database.workspace.deleteMany({
      where: { slug: `content-service-test-${suffix}` },
    });
    await database.$disconnect();
  });

  it("runs the full research -> draft -> claims -> approval -> revision lifecycle", async () => {
    const brand = await brandService.createBrand(ctx, {
      name: `Drafted${suffix}`,
      websiteUrl: `https://drafted-${suffix}.test`,
      description: "A disposable integration-test SaaS project.",
      category: "Integration test software",
      competitors: [],
    });

    const item = await contentService.createContentItem(ctx, {
      brandId: brand.id,
      title: "How to Fix a Widget",
      targetWordCount: 800,
    });
    expect(item.state).toBe("PLANNED");

    const brief: BriefResult = {
      audience: "SMB operators",
      intent: "Informational",
      angle: "Practical troubleshooting",
      outline: [
        {
          heading: "Diagnosing the problem",
          level: 2,
          notes: "",
          coverageGoal: "Explain common symptoms",
        },
        {
          heading: "Fixing it",
          level: 2,
          notes: "",
          coverageGoal: "Step by step fix",
        },
      ],
      firstPartyInputsNeeded: [],
      internalLinkCandidates: [],
      visualSuggestions: [],
      schemaRecommendation: "Article",
    };

    const packet = await contentService.persistResearchPacket(ctx, {
      contentItemId: item.id,
      brief,
      evidence: [
        {
          url: `https://drafted-${suffix}.test/evidence`,
          title: "Evidence",
          snippet: null,
        },
      ],
    });
    expect(packet.outline).toHaveLength(2);

    const afterBrief = await contentService.getContentItem(ctx, item.id);
    expect(afterBrief?.state).toBe("BRIEF_READY");

    const placeholder = await contentService.createDraftPlaceholderVersion(
      ctx,
      {
        contentItemId: item.id,
        isRevision: false,
      },
    );
    expect(placeholder.versionNumber).toBe(1);
    expect(placeholder.parentVersionId).toBeNull();

    const afterPlaceholder = await contentService.getContentItem(ctx, item.id);
    expect(afterPlaceholder?.state).toBe("DRAFTING");

    const assembled: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Diagnosing the problem" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Our product fails when overloaded [SOURCE NEEDED].",
            },
          ],
        },
      ],
    };

    const finalized = await contentService.finalizeDraftVersion(ctx, {
      versionId: placeholder.id,
      contentItemId: item.id,
      doc: assembled,
    });
    expect(finalized.wordCount).toBeGreaterThan(0);

    const afterFinalize = await contentService.getContentItem(ctx, item.id);
    expect(afterFinalize?.state).toBe("IN_REVIEW");
    // The [SOURCE NEEDED] placeholder must block approval even with zero claims.
    expect(afterFinalize?.blockers.map((b) => b.kind)).toContain("PLACEHOLDER");

    // Approval must be refused while the placeholder blocker exists.
    await expect(
      contentService.recordApproval(ctx, {
        versionId: finalized.id,
        contentItemId: item.id,
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "CONTENT_BLOCKED" });

    const claims: ClaimCandidate[] = [
      {
        text: "Our product processes 10,000 requests per second.",
        kind: "FACTUAL",
        riskCategory: null,
        evidenceUrl: null,
      },
      {
        text: "We think this is the best approach.",
        kind: "OPINION",
        riskCategory: null,
        evidenceUrl: null,
      },
    ];
    const persistedClaims = await contentService.persistClaims(ctx, {
      versionId: finalized.id,
      claims,
    });
    expect(persistedClaims).toHaveLength(2);
    const factual = persistedClaims.find((c) => c.kind === "FACTUAL");
    expect(factual?.status).toBe("UNRESOLVED");
    const opinion = persistedClaims.find((c) => c.kind === "OPINION");
    expect(opinion?.status).toBe("RESOLVED");

    const blockersWithClaims = await contentService.computeVersionBlockers(
      ctx,
      finalized.id,
    );
    expect(blockersWithClaims.map((b) => b.kind)).toEqual(
      expect.arrayContaining(["PLACEHOLDER", "UNSOURCED_CLAIM"]),
    );

    // Reject the draft — allowed even with blockers present.
    const rejection = await contentService.recordApproval(ctx, {
      versionId: finalized.id,
      contentItemId: item.id,
      decision: "CHANGES_REQUESTED",
      comment: "Needs a source.",
    });
    expect(rejection.decision).toBe("CHANGES_REQUESTED");

    const afterRejection = await contentService.getContentItem(ctx, item.id);
    expect(afterRejection?.state).toBe("CHANGES_REQUESTED");

    // Clean text, no unresolved claims -> approval succeeds.
    const cleanDoc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "This is now a clean draft." }],
        },
      ],
    };
    await contentService.updateDraftContent(ctx, {
      versionId: finalized.id,
      doc: cleanDoc,
    });
    // Delete the unresolved claim directly so this version has none left —
    // simulating a human editing the claim out along with the sentence.
    await database.claim.deleteMany({
      where: { contentVersionId: finalized.id },
    });

    const approval = await contentService.recordApproval(ctx, {
      versionId: finalized.id,
      contentItemId: item.id,
      decision: "APPROVED",
    });
    expect(approval.decision).toBe("APPROVED");

    const afterApproval = await contentService.getContentItem(ctx, item.id);
    expect(afterApproval?.state).toBe("APPROVED");

    // Approved versions are immutable — direct edits must be refused.
    await expect(
      contentService.updateDraftContent(ctx, {
        versionId: finalized.id,
        doc: cleanDoc,
      }),
    ).rejects.toThrow();

    // Editing after approval must go through createRevisionVersion, which
    // creates version 2 and moves the item back to DRAFTING.
    const revision = await contentService.createRevisionVersion(ctx, {
      contentItemId: item.id,
      doc: cleanDoc,
    });
    expect(revision.versionNumber).toBe(2);
    expect(revision.parentVersionId).toBe(finalized.id);

    const afterRevision = await contentService.getContentItem(ctx, item.id);
    expect(afterRevision?.state).toBe("DRAFTING");
    expect(afterRevision?.latestVersion?.id).toBe(revision.id);
  });
});
