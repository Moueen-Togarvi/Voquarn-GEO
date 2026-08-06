import type { Prompt } from "@/generated/prisma/client";
import type { PromptType } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";
import type { PromptDto } from "@/lib/prompts/types";

function toPromptDto(prompt: Prompt): PromptDto {
  return {
    id: prompt.id,
    text: prompt.text,
    type: prompt.type,
    source: prompt.source,
    isActive: prompt.isActive,
    approvedAt: prompt.approvedAt?.toISOString() ?? null,
    marketId: prompt.marketId,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString(),
  };
}

export async function listPrompts(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<PromptDto[]> {
  const prompts = await scopedDb(ctx).prompt.findMany({
    where: { brandId },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });
  return prompts.map(toPromptDto);
}

/** Only active prompts — what a batch actually runs against. */
export async function listActivePrompts(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<PromptDto[]> {
  const prompts = await scopedDb(ctx).prompt.findMany({
    where: { brandId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return prompts.map(toPromptDto);
}

/** A human typing a prompt in directly — already reviewed, so approvedAt is stamped immediately. */
export async function createPrompt(
  ctx: WorkspaceContext,
  input: { brandId: string; marketId: string; text: string; type: PromptType },
): Promise<PromptDto> {
  assertRole(ctx, "EDITOR");

  const prompt = await scopedDb(ctx).prompt.create({
    data: {
      workspaceId: ctx.workspaceId,
      brandId: input.brandId,
      marketId: input.marketId,
      text: input.text,
      type: input.type,
      source: "USER_ADDED",
      approvedAt: new Date(),
    },
  });

  return toPromptDto(prompt);
}

/**
 * AI-generated prompts land unapproved (approvedAt null) — a human must
 * review before they're trusted, though isActive defaults true so they are
 * immediately eligible for a batch; approval and inclusion are separate
 * concerns. Idempotent against @@unique([brandId, text]): re-generating
 * skips prompts that already exist rather than erroring.
 */
export async function bulkCreateGeneratedPrompts(
  ctx: WorkspaceContext,
  input: {
    brandId: string;
    marketId: string;
    prompts: { text: string; type: PromptType }[];
  },
): Promise<number> {
  assertRole(ctx, "EDITOR");

  const result = await scopedDb(ctx).prompt.createMany({
    data: input.prompts.map((prompt) => ({
      workspaceId: ctx.workspaceId,
      brandId: input.brandId,
      marketId: input.marketId,
      text: prompt.text,
      type: prompt.type,
      source: "AI_GENERATED" as const,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

/** Any edit — text or the active toggle — counts as human review, so approvedAt is always stamped. */
export async function updatePrompt(
  ctx: WorkspaceContext,
  promptId: string,
  input: { text?: string; isActive?: boolean },
): Promise<PromptDto> {
  assertRole(ctx, "EDITOR");

  try {
    const prompt = await scopedDb(ctx).prompt.update({
      where: { id: promptId },
      data: {
        text: input.text,
        isActive: input.isActive,
        approvedAt: new Date(),
      },
    });
    return toPromptDto(prompt);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(404, "PROMPT_NOT_FOUND", "Prompt not found.");
    }
    throw error;
  }
}

export async function deletePrompt(
  ctx: WorkspaceContext,
  promptId: string,
): Promise<{ deletedId: string }> {
  assertRole(ctx, "EDITOR");

  try {
    const deleted = await scopedDb(ctx).prompt.delete({
      where: { id: promptId },
      select: { id: true },
    });
    return { deletedId: deleted.id };
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(404, "PROMPT_NOT_FOUND", "Prompt not found.");
    }
    throw error;
  }
}
