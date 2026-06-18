// Home "Mood trend" widget: mood / energy / stress daily averages (30 days).

import { LineChartCard } from "@/components/charts";
import type { TrendResult } from "@/lib/analytics/types";

export function MoodTrendWidget({ trend }: { trend: TrendResult }) {
  return (
    <section>
      <LineChartCard
        title="Mood trend"
        data={trend.points}
        series={trend.series}
        xKey="x"
        height={180}
      />
    </section>
  );
}
