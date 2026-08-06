import { notFound } from "next/navigation";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { DraftThisButton } from "@/components/draft-this-button";
import { OpportunityDecisionButtons } from "@/components/opportunity-decision-buttons";
import { PageHeader } from "@/components/page-header";
import { RunOpportunityDetectionButton } from "@/components/run-opportunity-detection-button";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { listOpportunities } from "@/lib/opportunity/service";
import type { OpportunityDto } from "@/lib/opportunity/types";

export const metadata = { title: "Opportunities" };

const KIND_LABELS: Record<OpportunityDto["kind"], string> = {
  MISSING_COVERAGE: "Missing coverage",
  WEAK_COVERAGE: "Weak coverage",
  STALE: "Stale",
  INTENT_MISMATCH: "Intent mismatch",
  COMPARISON: "Comparison gap",
  CITATION_GAP: "Citation gap",
};

const VISIBLE_STATUSES = new Set<OpportunityDto["status"]>([
  "NEW",
  "ACCEPTED",
  "DEFERRED",
  "IN_PROGRESS",
]);

export default async function OpportunitiesPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const all = await listOpportunities(ctx, { brandId: brand.id });
  const opportunities = all.filter((item) => VISIBLE_STATUSES.has(item.status));
  const dismissedCount = all.length - opportunities.length;

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Gap attack"
        title="Opportunities"
        description="Where tracked competitors out-cover you — missing pages, thin content, stale pages, and citation gaps in AI answers — each traced back to the evidence that produced it."
        action={<RunOpportunityDetectionButton brandId={brand.id} />}
      />

      {opportunities.length === 0 ? (
        <p className="muted-text">
          No open opportunities yet. Run detection above once you have a crawl
          of your own site, at least one competitor crawl, and (for citation
          gaps) a benchmark run.
        </p>
      ) : (
        <div className="opportunity-list">
          {opportunities.map((opportunity) => (
            <div className="content-card opportunity-card" key={opportunity.id}>
              <div className="card-heading">
                <span className="status-pill">
                  {KIND_LABELS[opportunity.kind]}
                </span>
                <strong>{Math.round(opportunity.score)}</strong>
              </div>
              <h2>{opportunity.title}</h2>
              <p>{opportunity.summary}</p>
              {opportunity.recommendedActions.length > 0 ? (
                <ul className="opportunity-recommended-actions">
                  {opportunity.recommendedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              ) : null}
              <small className="muted-text">
                {Math.round(opportunity.confidence * 100)}% confidence
                {opportunity.status !== "NEW"
                  ? ` · ${opportunity.status.toLowerCase()}`
                  : ""}
              </small>
              <div className="opportunity-card-actions">
                <OpportunityDecisionButtons opportunityId={opportunity.id} />
                <div className="opportunity-actions">
                  <AddToPlanButton
                    brandId={brand.id}
                    opportunityId={opportunity.id}
                  />
                  <DraftThisButton
                    brandId={brand.id}
                    opportunityId={opportunity.id}
                    title={opportunity.title}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dismissedCount > 0 ? (
        <p className="muted-text">
          {dismissedCount} dismissed or completed opportunit
          {dismissedCount === 1 ? "y" : "ies"} hidden.
        </p>
      ) : null}
    </div>
  );
}
