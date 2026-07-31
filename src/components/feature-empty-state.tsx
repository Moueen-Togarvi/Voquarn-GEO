import { ArrowRight, type LucideIcon } from "lucide-react";

export function FeatureEmptyState({
  icon: Icon,
  title,
  description,
  points,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
}) {
  return (
    <section className="feature-empty-state">
      <div className="empty-icon">
        <Icon size={23} />
      </div>
      <span className="coming-badge">Next milestone</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="empty-points">
        {points.map((point) => (
          <div key={point}>
            <ArrowRight size={14} /> {point}
          </div>
        ))}
      </div>
    </section>
  );
}
