import { notFound } from "next/navigation";
import { CompetitorReview } from "@/components/competitor-review";
import { OnboardingShell } from "@/components/onboarding-shell";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrandForReview } from "@/lib/brands/service";

export const metadata = { title: "Review your profile" };

export default async function OnboardingReviewPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrandForReview(ctx, brandId);
  if (!brand || brand.status !== "DRAFT") notFound();

  return (
    <OnboardingShell
      eyebrow="Step 2 of 3"
      title="Review what we found."
      lead="Confirm the profile Voquarn researched and choose which competitors to track. Nothing is saved until you continue."
    >
      <nav className="wizard-steps" aria-label="Onboarding progress">
        <span className="is-done">Add company</span>
        <hr />
        <span className="is-current">Review profile</span>
        <hr />
        <span>Market & keywords</span>
      </nav>
      <CompetitorReview brand={brand} />
    </OnboardingShell>
  );
}
