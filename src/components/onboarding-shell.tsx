import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function OnboardingShell({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
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
          <Sparkles size={14} /> {eyebrow}
        </div>
        <h1>{title}</h1>
        {lead ? <p className="onboarding-lead">{lead}</p> : null}
        {children}
      </div>
    </main>
  );
}
