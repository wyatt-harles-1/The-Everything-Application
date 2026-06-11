// Themed single-series area chart with an accent gradient fill. Used for the
// "filled trend" look (e.g. nightly sleep duration). useId gives the gradient a
// unique id so multiple area charts on a page don't collide.

"use client";

import { useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

import {
  ACCENT,
  axisProps,
  gridProps,
  type RefLine,
  type RefBand,
} from "./chart-theme";
import { ChartTooltip } from "./ChartTooltip";
import { ChartCardShell } from "./ChartCardShell";

export function AreaChartCard({
  data,
  dataKey,
  xKey,
  label,
  title,
  hint,
  height = 220,
  color = ACCENT,
  yUnit,
  referenceLines,
  referenceAreas,
  className,
}: {
  data: Array<Record<string, number | string | null>>;
  dataKey: string;
  xKey: string;
  label: string;
  title?: string;
  hint?: string;
  height?: number;
  color?: string;
  yUnit?: string;
  referenceLines?: RefLine[];
  referenceAreas?: RefBand[];
  className?: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const yFormatter = yUnit
    ? (v: number | string) => `${v}${yUnit}`
    : undefined;

  return (
    <ChartCardShell title={title} hint={hint} height={height} className={className}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey={dataKey}
            name={label}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCardShell>
  );
}
