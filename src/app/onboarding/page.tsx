import { BrandForm } from "@/components/brand-form";
import { OnboardingShell } from "@/components/onboarding-shell";

export const metadata = { title: "Create a project" };

export default function OnboardingPage() {
  return (
    <OnboardingShell
      eyebrow="New tracking project"
      title="See how AI understands your brand."
      lead="Enter only your company name and website. Voquarn researches your product, category, and closest competitors automatically."
    >
      <BrandForm />
    </OnboardingShell>
  );
}
