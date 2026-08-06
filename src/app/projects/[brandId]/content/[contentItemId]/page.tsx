import { notFound } from "next/navigation";
import { ContentEditor } from "@/components/content-editor";
import { ContentGenerationStatus } from "@/components/content-generation-status";
import { PageHeader } from "@/components/page-header";
import { RunContentDraftButton } from "@/components/run-content-draft-button";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { getContentItem } from "@/lib/content/service";

export const metadata = { title: "Draft" };

const DRAFTABLE_STATES = new Set(["BRIEF_READY", "CHANGES_REQUESTED"]);

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ brandId: string; contentItemId: string }>;
}) {
  const { brandId, contentItemId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const item = await getContentItem(ctx, contentItemId);
  if (!item || item.brandId !== brand.id) notFound();

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Auto-build"
        title={item.title}
        description={
          item.researchPacket?.angle ?? "Evidence-backed brief and draft."
        }
        action={
          DRAFTABLE_STATES.has(item.state) ? (
            <RunContentDraftButton
              contentItemId={item.id}
              label={
                item.state === "CHANGES_REQUESTED" ? "Redraft" : "Write draft"
              }
            />
          ) : undefined
        }
      />

      <ContentGenerationStatus contentItemId={item.id} state={item.state} />

      {item.researchPacket && !item.latestVersion ? (
        <div className="content-card">
          <div className="card-heading">
            <h2>Brief</h2>
          </div>
          <ul className="domain-summary-list">
            <li>
              <span>Audience</span>
              <strong>{item.researchPacket.audience ?? "—"}</strong>
            </li>
            <li>
              <span>Intent</span>
              <strong>{item.researchPacket.intent ?? "—"}</strong>
            </li>
            <li>
              <span>Angle</span>
              <strong>{item.researchPacket.angle ?? "—"}</strong>
            </li>
          </ul>
          <ol className="content-blocker-list">
            {item.researchPacket.outline.map((section) => (
              <li key={section.heading}>
                <strong>{section.heading}</strong>
                <span>{section.coverageGoal}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {item.latestVersion ? (
        <ContentEditor item={item} />
      ) : !item.researchPacket ? (
        <p className="muted-text">
          Building the research packet and brief — this can take a minute.
        </p>
      ) : null}

      {item.approvals.length > 0 ? (
        <div className="content-card">
          <div className="card-heading">
            <h2>Review history</h2>
          </div>
          <ul className="content-claim-list">
            {item.approvals.map((approval) => (
              <li key={approval.id}>
                <span className="status-pill">{approval.decision}</span>
                {approval.comment ? <p>{approval.comment}</p> : null}
                <small className="muted-text">
                  {new Date(approval.decidedAt).toLocaleString()}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
