import { Globe2 } from "lucide-react";
import { notFound } from "next/navigation";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import {
  listSourceDomainSummary,
  listSourcesForBrand,
} from "@/lib/sources/service";

export const metadata = { title: "Sources" };

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const [domains, sources] = await Promise.all([
    listSourceDomainSummary(ctx, brand.id),
    listSourcesForBrand(ctx, brand.id, { limit: 60 }),
  ]);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Intelligence"
        title="Sources"
        description="Understand which domains and pages shape AI answers in your category."
      />

      {domains.length === 0 ? (
        <FeatureEmptyState
          icon={Globe2}
          title="Sources appear after your first analysis"
          description="Web search results retrieved while researching your project or running a benchmark are normalized by domain and stored here."
          points={[
            "See the most frequently retrieved domains",
            "Inspect the exact URLs behind each AI answer",
            "Separate cited sources from supporting search results",
          ]}
        />
      ) : (
        <div className="overview-grid">
          <div className="content-card">
            <div className="card-heading">
              <h2>Retrieved pages</h2>
            </div>
            <ul className="source-list">
              {sources.map((source) => (
                <li className="source-row" key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    <Globe2 size={14} />
                    <span>
                      <strong>{source.title ?? source.domain}</strong>
                      <small>{source.domain}</small>
                    </span>
                  </a>
                  {source.isCitation ? (
                    <small className="status-pill success">Citation</small>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="content-card">
            <div className="card-heading">
              <h2>Top domains</h2>
            </div>
            <ul className="domain-summary-list">
              {domains.slice(0, 15).map((domain) => (
                <li key={domain.domain}>
                  <span>{domain.domain}</span>
                  <strong>{domain.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
