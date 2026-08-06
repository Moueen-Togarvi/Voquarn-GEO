import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";

export type BrandVoiceProfileDto = {
  tone: string | null;
  audience: string | null;
  guidelines: string | null;
  approvedSamples: string[];
};

function toDto(
  profile: {
    tone: string | null;
    audience: string | null;
    guidelines: string | null;
    approvedSamples: unknown;
  } | null,
): BrandVoiceProfileDto {
  return {
    tone: profile?.tone ?? null,
    audience: profile?.audience ?? null,
    guidelines: profile?.guidelines ?? null,
    approvedSamples: Array.isArray(profile?.approvedSamples)
      ? (profile.approvedSamples as string[])
      : [],
  };
}

export async function getBrandVoiceProfile(
  ctx: WorkspaceContext,
  brandId: string,
): Promise<BrandVoiceProfileDto> {
  const profile = await scopedDb(ctx).brandVoiceProfile.findUnique({
    where: { brandId },
  });
  return toDto(profile);
}

/**
 * The only writer of BrandVoiceProfile.approvedSamples — a human explicitly
 * choosing "yes, this text represents our voice," never populated any other
 * way (not from a crawl, not from an LLM guess). See the model comment in
 * schema.prisma.
 */
export async function addApprovedVoiceSample(
  ctx: WorkspaceContext,
  brandId: string,
  text: string,
): Promise<BrandVoiceProfileDto> {
  assertRole(ctx, "EDITOR");

  const existing = await scopedDb(ctx).brandVoiceProfile.findUnique({
    where: { brandId },
  });
  const current = Array.isArray(existing?.approvedSamples)
    ? (existing.approvedSamples as string[])
    : [];
  const updated = [...current, text];

  const profile = await scopedDb(ctx).brandVoiceProfile.upsert({
    where: { brandId },
    update: { approvedSamples: updated },
    create: { workspaceId: ctx.workspaceId, brandId, approvedSamples: updated },
  });

  return toDto(profile);
}
