/**
 * Server-rendered inline SVG — no charting library. See CLAUDE.md: Recharts
 * is client-only and fights RSC; a real interactive chart library arrives in
 * Phase 7 for GSC time series. This is enough for a batch-over-batch trend.
 */
export function Sparkline({
  values,
  width = 120,
  height = 32,
}: {
  /** Oldest first. Values outside [0, 1] are clamped. */
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <svg
        className="sparkline"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  const padding = 3;
  const step = (width - padding * 2) / (values.length - 1);
  const points = values.map((raw, index) => {
    const clamped = Math.min(1, Math.max(0, raw));
    const x = padding + index * step;
    const y = padding + (1 - clamped) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1]?.split(",")[0]}
        cy={points[points.length - 1]?.split(",")[1]}
        r={2.25}
        fill="currentColor"
      />
    </svg>
  );
}
