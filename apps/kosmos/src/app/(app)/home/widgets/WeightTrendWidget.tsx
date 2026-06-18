// Home "Weight trend" widget: body weight over the last 90 days.

import { LineChartCard } from "@/components/charts";
import type { TrendResult } from "@/lib/analytics/types";

export function WeightTrendWidget({ trend }: { trend: TrendResult }) {
  const delta = trend.summary?.delta ?? null;
  return (
    <section>
      <LineChartCard
        title="Weight trend"
        hint={
          delta != null ? `${delta >= 0 ? "+" : ""}${delta} lb (90d)` : undefined
        }
        data={trend.points}
        series={trend.series}
        xKey="x"
        yUnit=" lb"
        height={180}
      />
    </section>
  );
}
