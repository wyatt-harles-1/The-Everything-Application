// Tiny inline SVG line chart. No dependency, no axes - just the line
// connecting the points. Used for e1RM history on exercise detail and
// for weekly volume trends on the lifting dashboard. Points are evenly
// spaced on the x-axis (we pass an array of y-values); if you need real
// dates on x, pass equally spaced anyway and label the period elsewhere.

export function Sparkline({
  values,
  width = 280,
  height = 60,
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length === 0) {
    return (
      <div
        style={{ width, height }}
        className={`flex items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500 ${className}`}
      >
        no data
      </div>
    );
  }

  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    // Invert y because SVG 0 is at the top.
    const y = pad + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");

  // Single-point edge case: render a single dot.
  if (points.length === 1) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        aria-hidden
      >
        <circle cx={points[0][0]} cy={points[0][1]} r={3} className="fill-current" />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={1.5} className="fill-current" />
      ))}
    </svg>
  );
}
