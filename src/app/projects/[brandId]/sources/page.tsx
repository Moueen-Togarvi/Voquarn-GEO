import { Globe2 } from "lucide-react";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Sources" };

export default function SourcesPage() {
  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Intelligence"
        title="Sources"
        description="Understand which domains and pages shape AI answers in your category."
      />
      <FeatureEmptyState
        icon={Globe2}
        title="Sources appear after your first analysis"
        description="GLM-5.1 web search results will be normalized by domain and stored separately from explicit citations."
        points={[
          "See the most frequently retrieved domains",
          "Inspect the exact URLs behind each AI answer",
          "Separate cited sources from supporting search results",
        ]}
      />
    </div>
  );
}
