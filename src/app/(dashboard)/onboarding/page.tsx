import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserBrands } from "@/lib/queries";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const dynamic = "force-dynamic";

/** First-run onboarding. Users who already have brands go to the dashboard. */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  const brands = user ? await getUserBrands(user.id) : [];
  if (brands.length > 0) redirect("/dashboard");

  return <OnboardingWizard />;
}
