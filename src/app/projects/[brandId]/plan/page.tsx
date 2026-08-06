import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getBrand } from "@/lib/brands/service";
import { listCurrentPlanItems } from "@/lib/opportunity/service";

export const metadata = { title: "This week's plan" };

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const format = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${format(start)} – ${format(end)}`;
}

export default async function PlanPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const ctx = await requireWorkspaceContext();
  const brand = await getBrand(ctx, brandId);
  if (!brand) notFound();

  const { plan, items } = await listCurrentPlanItems(ctx, brand.id);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Gap attack"
        title="This week's plan"
        description={`${formatWeekRange(plan.weekStart)} — a short, focused list, not a forced publishing quota. Add opportunities from the Opportunities tab.`}
      />

      {items.length === 0 ? (
        <p className="muted-text">
          Nothing on the plan yet. Add up to a few opportunities from the
          Opportunities tab — this works best as a short list, not a backlog.
        </p>
      ) : (
        <div className="content-card">
          <ul className="batch-list">
            {items.map((item) => (
              <li key={item.id}>
                <div className="batch-row">
                  <span className="batch-row-copy">
                    <strong>{item.opportunity.title}</strong>
                    <small>{item.opportunity.summary}</small>
                  </span>
                  <span className="batch-row-metric">
                    <strong>{Math.round(item.opportunity.score)}</strong>
                    <small>
                      {item.dueAt
                        ? `Due ${new Date(item.dueAt).toLocaleDateString()}`
                        : "No due date"}
                    </small>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
