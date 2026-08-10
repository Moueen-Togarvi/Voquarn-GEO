import { BrandForm } from "@/components/brand-form";
import { OnboardingShell } from "@/components/onboarding-shell";

export const metadata = { title: "Create a project" };

export default function OnboardingPage() {
  return (
    <OnboardingShell
      eyebrow="New tracking project"
      title="See how AI understands your brand."
      lead="Enter only your website domain. Voquarn identifies your brand, researches the market, builds buyer prompts, and finds your closest competitors automatically."
    >
      <BrandForm />
    </OnboardingShell>
  );
}
