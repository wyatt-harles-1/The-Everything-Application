// Themed multi-series line chart. Feed it plain serialized rows (no Dates —
// pre-format x to a label string server-side). Colors default to the
// categorical palette; pass a series.color of "var(--color-accent)" for a
// single-series accent chart.

"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

import {
  CHART_COLORS,
  axisProps,
  gridProps,
  type ChartSeries,
  type RefLine,
  type RefBand,
} from "./chart-theme";
import { ChartTooltip } from "./ChartTooltip";
import { ChartCardShell } from "./ChartCardShell";

export function LineChartCard({
  data,
  series,
  xKey,
  title,
  hint,
  height = 220,
  yUnit,
  referenceLines,
  referenceAreas,
  className,
}: {
  data: Array<Record<string, number | string | null>>;
  series: ChartSeries[];
  xKey: string;
  title?: string;
  hint?: string;
  height?: number;
  yUnit?: string;
  referenceLines?: RefLine[];
  referenceAreas?: RefBand[];
  className?: string;
}) {
  // Built client-side from the serializable `yUnit` (functions can't be passed
  // from the server components that render these cards).
  const yFormatter = yUnit
    ? (v: number | string) => `${v}${yUnit}`
    : undefined;
  return (
    <ChartCardShell title={title} hint={hint} height={height} className={className}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} width={44} tickFormatter={yFormatter} />
          <Tooltip
            content={<ChartTooltip valueFormatter={yFormatter} />}
            cursor={{ stroke: "var(--color-border)" }}
          />
          {referenceAreas?.map((a, i) => (
            <ReferenceArea
              key={`area-${i}`}
              y1={a.y1}
              y2={a.y2}
              fill={a.color ?? "var(--color-success-soft)"}
              fillOpacity={0.6}
              ifOverflow="extendDomain"
            />
          ))}
          {referenceLines?.map((l, i) => (
            <ReferenceLine
              key={`line-${i}`}
              y={l.y}
              stroke={l.color ?? "var(--color-muted)"}
              strokeDasharray="4 4"
              label={
                l.label
                  ? { value: l.label, position: "right", fill: "var(--color-muted)", fontSize: 10 }
                  : undefined
              }
            />
          ))}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCardShell>
  );
}
