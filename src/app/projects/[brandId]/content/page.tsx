import { FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { listContentItems } from "@/lib/content/service";

export const metadata = { title: "Content" };

const STATE_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  RESEARCHING: "Researching",
  BRIEF_READY: "Brief ready",
  DRAFTING: "Drafting",
  IN_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  MONITORING: "Monitoring",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
  ARCHIVED: "Archived",
  ROLLED_BACK: "Rolled back",
};

export default async function ContentPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const items = await listContentItems(ctx, brand.id);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Auto-build"
        title="Content"
        description="Evidence-backed briefs and drafts, one per opportunity — every claim traces back to a source or is explicitly marked opinion or first-party. Start a new one from an opportunity on the Opportunities tab."
      />

      {items.length === 0 ? (
        <p className="muted-text">
          No content yet. Go to Opportunities and choose &ldquo;Draft
          this&rdquo; on one worth acting on.
        </p>
      ) : (
        <div className="content-card">
          <ul className="batch-list">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  className="batch-row"
                  href={`/projects/${brand.id}/content/${item.id}`}
                >
                  <span className="batch-status">
                    <FileText size={16} />
                  </span>
                  <span className="batch-row-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {item.targetWordCount
                        ? `~${item.targetWordCount} words`
                        : "No target length set"}
                    </small>
                  </span>
                  <span className="batch-row-metric">
                    <strong>{STATE_LABELS[item.state] ?? item.state}</strong>
                    <small>
                      Updated {new Date(item.updatedAt).toLocaleDateString()}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
