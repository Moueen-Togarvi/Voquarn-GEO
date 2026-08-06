"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { activateBrand, setBrandMarket } from "@/lib/brands/service";
import { createGoal } from "@/lib/goals/service";
import { bulkAddKeywords } from "@/lib/keywords/service";
import { findOrCreateMarket } from "@/lib/markets/service";

const goalTypes = [
  "INCREASE_AI_VISIBILITY",
  "INCREASE_ORGANIC_TRAFFIC",
  "IMPROVE_SHARE_OF_VOICE",
  "OUTRANK_COMPETITOR",
  "OTHER",
] as const;

const marketSchema = z.object({
  brandId: z.string().min(1),
  country: z
    .string()
    .trim()
    .length(2, "Use a 2-letter country code, e.g. US.")
    .toUpperCase(),
  region: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  language: z
    .string()
    .trim()
    .min(2, "Use a language code, e.g. en.")
    .max(10)
    .toLowerCase(),
  device: z.enum(["DESKTOP", "MOBILE"]),
  timezone: z.string().trim().min(1, "Timezone is required."),
  keywords: z.string().optional(),
  goalType: z.enum(goalTypes).optional(),
  goalNotes: z.string().trim().max(400).optional(),
});

export type MarketFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function finalizeOnboardingAction(
  _prevState: MarketFormState,
  formData: FormData,
): Promise<MarketFormState> {
  const ctx = await requireWorkspaceContext();

  const goalType = formData.get("goalType");
  const parsed = marketSchema.safeParse({
    brandId: formData.get("brandId"),
    country: formData.get("country"),
    region: formData.get("region") || undefined,
    city: formData.get("city") || undefined,
    language: formData.get("language"),
    device: formData.get("device"),
    timezone: formData.get("timezone"),
    keywords: formData.get("keywords") || undefined,
    goalType: goalType ? goalType : undefined,
    goalNotes: formData.get("goalNotes") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    return { fieldErrors };
  }

  try {
    const market = await findOrCreateMarket(ctx, {
      country: parsed.data.country,
      region: parsed.data.region ?? null,
      city: parsed.data.city ?? null,
      language: parsed.data.language,
      device: parsed.data.device,
      timezone: parsed.data.timezone,
    });

    await setBrandMarket(ctx, parsed.data.brandId, {
      defaultMarketId: market.id,
      timezone: parsed.data.timezone,
    });

    const keywordLines = (parsed.data.keywords ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (keywordLines.length > 0) {
      await bulkAddKeywords(ctx, {
        brandId: parsed.data.brandId,
        marketId: market.id,
        keywords: keywordLines,
      });
    }

    if (parsed.data.goalType) {
      await createGoal(ctx, {
        brandId: parsed.data.brandId,
        type: parsed.data.goalType,
        notes: parsed.data.goalNotes || null,
      });
    }

    await activateBrand(ctx, parsed.data.brandId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }

  redirect(`/projects/${parsed.data.brandId}/overview`);
}
