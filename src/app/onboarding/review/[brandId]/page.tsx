import { notFound } from "next/navigation";
import { CompetitorReview } from "@/components/competitor-review";
import { OnboardingShell } from "@/components/onboarding-shell";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrandForReview } from "@/lib/brands/service";
import { getLatestOperationForBrand } from "@/lib/operations/service";
import { listPrompts } from "@/lib/prompts/service";

export const metadata = { title: "Review your profile" };

function readCount(
  metadata: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}

export default async function OnboardingReviewPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrandForReview(ctx, brandId);
  if (!brand || brand.status !== "DRAFT") notFound();

  // brandDiscovery fires the COMPETITOR_EXPANSION operation as its own
  // last step, before it itself completes — so this row already exists by
  // the time this page renders, letting the client start polling
  // immediately on mount instead of waiting for a button click.
  const [discoveryOperation, expansionOperation, promptOperation, prompts] =
    await Promise.all([
      getLatestOperationForBrand(ctx, brandId, "BRAND_DISCOVERY"),
      getLatestOperationForBrand(ctx, brandId, "COMPETITOR_EXPANSION"),
      getLatestOperationForBrand(ctx, brandId, "PROMPT_GENERATION"),
      listPrompts(ctx, brandId),
    ]);

  return (
    <OnboardingShell
      eyebrow="Step 2 of 3"
      title="Review your AI prompts."
      lead="Voquarn created realistic buyer questions from your website. These prompts will be run against AI to measure which brands it recommends and calculate your market position."
    >
      <nav className="wizard-steps" aria-label="Onboarding progress">
        <span className="is-done">Add domain</span>
        <hr />
        <span className="is-current">Review prompts</span>
        <hr />
        <span>AI benchmark</span>
      </nav>
      <CompetitorReview
        brand={brand}
        prompts={prompts}
        sourceCount={readCount(
          discoveryOperation?.metadata ?? null,
          "sourceCount",
        )}
        initialExpansionOperationId={
          expansionOperation &&
          (expansionOperation.status === "PENDING" ||
            expansionOperation.status === "RUNNING")
            ? expansionOperation.id
            : null
        }
        initialPromptOperationId={
          promptOperation &&
          (promptOperation.status === "PENDING" ||
            promptOperation.status === "RUNNING")
            ? promptOperation.id
            : null
        }
        initialPromptError={
          promptOperation &&
          (promptOperation.status === "FAILED" ||
            promptOperation.status === "CANCELLED")
            ? (promptOperation.errorMessage ??
              "Prompt generation did not complete.")
            : null
        }
      />
    </OnboardingShell>
  );
}
