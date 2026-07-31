import { FileQuestion } from "lucide-react";
import { FeatureEmptyState } from "@/components/feature-empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Prompts" };

export default function PromptsPage() {
  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Measurement"
        title="Prompts"
        description="The buyer questions that determine where your brand appears in AI answers."
      />
      <FeatureEmptyState
        icon={FileQuestion}
        title="Your prompt library comes next"
        description="GLM-5.1 will generate a balanced set of category, comparison, use-case, and brand-specific questions for your approval."
        points={[
          "Generate 20–30 realistic buyer questions",
          "Edit, disable, or add your own prompts",
          "Keep every prompt grouped by buyer intent",
        ]}
      />
    </div>
  );
}
