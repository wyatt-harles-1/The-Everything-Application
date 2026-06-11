// Home "Training load" widget: weekly lifting volume (lb) over 12 weeks.

import { BarChartCard } from "@/components/charts";
import type { TrendResult } from "@/lib/analytics/types";

export function TrainingLoadWidget({ trend }: { trend: TrendResult }) {
  return (
    <section>
      <BarChartCard
        title="Training load"
        hint="weekly volume"
        data={trend.points}
        series={trend.series}
        xKey="x"
        height={180}
      />
    </section>
  );
}
