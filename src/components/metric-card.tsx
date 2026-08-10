import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export type MetricTrend = {
  direction: "up" | "down" | "flat";
  label: string;
};

const TREND_ICONS = { up: ArrowUp, down: ArrowDown, flat: Minus };

export function MetricCard({
  label,
  value,
  caption,
  trend,
}: {
  label: string;
  value: string;
  caption: string;
  trend?: MetricTrend;
}) {
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
      {trend && TrendIcon ? (
        <span className={`metric-trend metric-trend-${trend.direction}`}>
          <TrendIcon size={12} /> {trend.label}
        </span>
      ) : null}
    </article>
  );
}
