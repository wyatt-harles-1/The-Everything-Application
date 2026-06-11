// /health/dashboard — the deep analytics view for health & recovery, and the
// template that proves the chart-kit + analytics layer (M3 rolls this shape out
// to lifting/running/etc). All data fetching is server-side via the analytics
// builders; each section self-hides when its metric has no data, so the page
// stays meaningful whether or not Oura/body tracking is connected.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  sleepTrend,
  readinessTrend,
  moodTrend,
  weightTrend,
} from "@/lib/analytics/metrics";
import { LineChartCard, AreaChartCard, RadialStat } from "@/components/charts";

export default async function HealthDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [sleep, readiness, mood, weight] = await Promise.all([
    sleepTrend(supabase, 30),
    readinessTrend(supabase, 30),
    moodTrend(supabase, 30),
    weightTrend(supabase, 90),
  ]);

  const hasAny =
    sleep.points.length > 0 ||
    readiness.points.length > 0 ||
    mood.points.length > 0 ||
    weight.points.length > 0;

  const avg7d = sleep.summary?.avg7d ?? null;
  const latestReadiness = readiness.summary?.latestScore ?? null;
  const weightDelta = weight.summary?.delta ?? null;

  return (
    <div className="space-y-[var(--gap-section)]">
      <header className="space-y-1">
        <Link
          href="/health"
          className="text-xs text-muted transition-colors hover:text-text"
        >
          ← Health
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
          Health trends
        </h1>
        <p className="text-sm text-muted">
          Sleep, recovery, mood, and body over time — pulled from your logs and
          connected devices.
        </p>
      </header>

      {!hasAny ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-sm text-muted">
          No health data yet. Log sleep, mood, or body measurements (or connect
          Oura) and trends will appear here.
        </p>
      ) : null}

      {sleep.points.length > 0 ? (
        <AreaChartCard
          title="Sleep"
          hint={avg7d != null ? `${avg7d}h avg (7d)` : undefined}
          data={sleep.points}
          dataKey="hours"
          xKey="x"
          label="Sleep (h)"
          yUnit="h"
          referenceAreas={[{ y1: 7, y2: 9 }]}
          referenceLines={
            avg7d != null ? [{ y: avg7d, label: "7-day avg" }] : undefined
          }
        />
      ) : null}

      {readiness.points.length > 0 ? (
        <div className="grid grid-cols-1 gap-[var(--gap-section)] sm:grid-cols-3">
          <RadialStat
            value={latestReadiness ?? 0}
            label="Readiness"
            hint="today"
            className="sm:col-span-1"
          />
          <LineChartCard
            title="Recovery (Oura)"
            data={readiness.points}
            series={readiness.series}
            xKey="x"
            className="sm:col-span-2"
          />
        </div>
      ) : null}

      {mood.points.length > 0 ? (
        <LineChartCard
          title="Mood, energy & stress"
          data={mood.points}
          series={mood.series}
          xKey="x"
        />
      ) : null}

      {weight.points.length > 0 ? (
        <LineChartCard
          title="Body weight"
          hint={
            weightDelta != null
              ? `${weightDelta >= 0 ? "+" : ""}${weightDelta} lb (90d)`
              : undefined
          }
          data={weight.points}
          series={weight.series}
          xKey="x"
          yUnit=" lb"
        />
      ) : null}
    </div>
  );
}
