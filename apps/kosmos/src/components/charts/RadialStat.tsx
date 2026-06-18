// A radial gauge for a single 0–max score (e.g. Oura readiness 0–100), with the
// value overlaid in the center. Accent fill on a muted track.

"use client";

import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

import { Card } from "@/components/ui/Card";
import { ACCENT } from "./chart-theme";

export function RadialStat({
  value,
  max = 100,
  label,
  hint,
  height = 170,
  color = ACCENT,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  hint?: string;
  height?: number;
  color?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      {label ? (
        <h3 className="mb-1 text-sm font-semibold text-text">{label}</h3>
      ) : null}
      <div className="relative" style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <RadialBarChart
            data={[{ value }]}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={999}
              fill={color}
              background={{ fill: "var(--color-hover)" }}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums text-text">{value}</span>
          {hint ? <span className="text-xs text-muted">{hint}</span> : null}
        </div>
      </div>
    </Card>
  );
}
