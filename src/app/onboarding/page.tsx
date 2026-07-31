import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { BrandForm } from "@/components/brand-form";

export const metadata = { title: "Create a project" };

export default function OnboardingPage() {
  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">V</span>
          <span>
            Voquarn <strong>GEO</strong>
          </span>
        </Link>
        <Link className="button button-ghost compact-button" href="/">
          <ArrowLeft size={15} /> Workspace
        </Link>
      </header>

      <div className="onboarding-shell">
        <div className="eyebrow">
          <Sparkles size={14} /> New tracking project
        </div>
        <h1>See how AI understands your brand.</h1>
        <p className="onboarding-lead">
          Add your SaaS product and closest competitors. This becomes the clean
          data foundation for every visibility analysis.
        </p>
        <BrandForm />
      </div>
    </main>
  );
}
