import { notFound } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding-shell";
import { MarketSetupForm } from "@/components/market-setup-form";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrandForReview } from "@/lib/brands/service";

export const metadata = { title: "Set up your market" };

export default async function OnboardingMarketPage({
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
      eyebrow="Step 3 of 3"
      title="Where should we look?"
      lead="Pick the market Voquarn should track by default, and optionally add the keywords and goal you care about most."
    >
      <nav className="wizard-steps" aria-label="Onboarding progress">
        <span className="is-done">Add company</span>
        <hr />
        <span className="is-done">Review profile</span>
        <hr />
        <span className="is-current">Market & keywords</span>
      </nav>
      <MarketSetupForm brandId={brand.id} defaultTimezone="UTC" />
    </OnboardingShell>
  );
}
