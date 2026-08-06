import type { ProjectKeywordPriority } from "@/generated/prisma/enums";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";
import { normalizeKeyword } from "@/lib/keywords/normalize";

export type ProjectKeywordDto = {
  id: string;
  priority: ProjectKeywordPriority;
  keyword: { id: string; text: string };
};

export type BulkAddKeywordsInput = {
  brandId: string;
  marketId: string;
  topicId?: string | null;
  keywords: string[];
  priority?: ProjectKeywordPriority;
};

/**
 * Idempotent: re-running with the same text list does not create duplicate
 * Keyword rows (unique per market + normalized text) or duplicate
 * ProjectKeyword links (unique per brand + keyword) — a user pasting an
 * overlapping list twice during onboarding is the expected case, not an
 * error. Runs as N sequential upserts rather than a single batched query;
 * fine at onboarding volume (tens of keywords), revisit if Phase 3's bulk
 * import needs more.
 */
export async function bulkAddKeywords(
  ctx: WorkspaceContext,
  input: BulkAddKeywordsInput,
): Promise<{ linkedCount: number }> {
  const seen = new Set<string>();
  let linkedCount = 0;

  for (const rawText of input.keywords) {
    const text = rawText.trim();
    if (!text) continue;

    const normalized = normalizeKeyword(text);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const keyword = await scopedDb(ctx).keyword.upsert({
      where: {
        marketId_normalized: { marketId: input.marketId, normalized },
      },
      update: {},
      create: {
        workspaceId: ctx.workspaceId,
        marketId: input.marketId,
        topicId: input.topicId ?? null,
        text,
        normalized,
      },
    });

    await scopedDb(ctx).projectKeyword.upsert({
      where: {
        brandId_keywordId: { brandId: input.brandId, keywordId: keyword.id },
      },
      update: {},
      create: {
        workspaceId: ctx.workspaceId,
        brandId: input.brandId,
        keywordId: keyword.id,
        priority: input.priority ?? "MEDIUM",
      },
    });

    linkedCount += 1;
  }

  return { linkedCount };
}

export async function listProjectKeywords(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<ProjectKeywordDto[]> {
  const rows = await scopedDb(ctx).projectKeyword.findMany({
    where: { brandId },
    include: { keyword: { select: { id: true, text: true } } },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    priority: row.priority,
    keyword: row.keyword,
  }));
}
