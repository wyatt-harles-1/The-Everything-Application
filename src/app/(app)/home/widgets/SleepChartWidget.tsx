// Home "Sleep trend" widget: nightly sleep duration over the last 30 days.
// Server component fed a pre-built TrendResult; renders a client area chart.

import { AreaChartCard } from "@/components/charts";
import type { TrendResult } from "@/lib/analytics/types";

export function SleepChartWidget({ trend }: { trend: TrendResult }) {
  const avg7d = trend.summary?.avg7d ?? null;
  return (
    <section>
      <AreaChartCard
        title="Sleep trend"
        hint={avg7d != null ? `${avg7d}h avg (7d)` : undefined}
        data={trend.points}
        dataKey="hours"
        xKey="x"
        label="Sleep (h)"
        yUnit="h"
        height={180}
      />
    </section>
  );
}
