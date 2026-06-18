// Themed bar chart (one or more series). Used for weekly training volume, etc.

"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import {
  ACCENT,
  CHART_COLORS,
  axisProps,
  gridProps,
  type ChartSeries,
} from "./chart-theme";
import { ChartTooltip } from "./ChartTooltip";
import { ChartCardShell } from "./ChartCardShell";

export function BarChartCard({
  data,
  series,
  xKey,
  title,
  hint,
  height = 220,
  yUnit,
  className,
}: {
  data: Array<Record<string, number | string | null>>;
  series: ChartSeries[];
  xKey: string;
  title?: string;
  hint?: string;
  height?: number;
  yUnit?: string;
  className?: string;
}) {
  const yFormatter = yUnit
    ? (v: number | string) => `${v}${yUnit}`
    : undefined;
  return (
    <ChartCardShell title={title} hint={hint} height={height} className={className}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={16} />
          <YAxis {...axisProps} width={44} tickFormatter={yFormatter} />
          <Tooltip
            content={<ChartTooltip valueFormatter={yFormatter} />}
            cursor={{ fill: "var(--color-hover)" }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color ?? (series.length === 1 ? ACCENT : CHART_COLORS[i % CHART_COLORS.length])}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCardShell>
  );
}
