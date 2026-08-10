"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWorkspaceContext } from "@/lib/auth/context";
import {
  activateBrand,
  setBrandMarket,
  updateDraftProfile,
} from "@/lib/brands/service";
import { bulkUpdateCompetitorStatus } from "@/lib/competitors/service";
import { findOrCreateMarket } from "@/lib/markets/service";

const reviewSchema = z.object({
  brandId: z.string().min(1),
  description: z.string().trim().min(10, "Add a bit more detail.").max(400),
  category: z.string().trim().min(3, "Add a specific category.").max(100),
});

export type ReviewFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveReviewAction(
  _prevState: ReviewFormState,
  formData: FormData,
): Promise<ReviewFormState> {
  const ctx = await requireWorkspaceContext();

  const parsed = reviewSchema.safeParse({
    brandId: formData.get("brandId"),
    description: formData.get("description"),
    category: formData.get("category"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    return { fieldErrors };
  }

  const acceptedIds = new Set(
    formData.getAll("acceptedCompetitorIds").map(String),
  );
  const allCompetitorIds = formData.getAll("allCompetitorIds").map(String);
  const ignoredIds = allCompetitorIds.filter((id) => !acceptedIds.has(id));

  let redirectTo: string | null = null;
  try {
    await updateDraftProfile(ctx, parsed.data.brandId, {
      description: parsed.data.description,
      category: parsed.data.category,
    });

    await bulkUpdateCompetitorStatus(ctx, {
      acceptedIds: [...acceptedIds],
      ignoredIds,
    });

    // Domain-only onboarding uses a sensible default monitoring market. The
    // project settings page still allows this to be refined later, while the
    // user can move straight to real prompt execution now.
    const market = await findOrCreateMarket(ctx, {
      country: "US",
      region: null,
      city: null,
      language: "en",
      device: "DESKTOP",
      timezone: "UTC",
    });
    await setBrandMarket(ctx, parsed.data.brandId, {
      defaultMarketId: market.id,
      timezone: market.timezone,
    });
    await activateBrand(ctx, parsed.data.brandId);

    redirectTo = `/onboarding/benchmark/${parsed.data.brandId}`;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }

  redirect(redirectTo);
}
