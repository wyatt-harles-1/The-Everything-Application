// /running/dashboard - 12-week mileage trend, recent paces, and totals.
// Same lightweight aggregation pattern as /lifting/dashboard.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/Sparkline";
import { formatDate } from "@/lib/format";
import {
  formatMiles,
  formatDuration,
  formatPace,
  metersToMiles,
} from "@/lib/running/format";

type WorkoutWithCardio = {
  id: string;
  started_at: string;
  title: string | null;
  cardio_sessions:
    | { distance_meters: number | null; duration_seconds: number | null; avg_heart_rate: number | null }
    | { distance_meters: number | null; duration_seconds: number | null; avg_heart_rate: number | null }[]
    | null;
};

function startOfWeekUTC(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = out.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  out.setUTCDate(out.getUTCDate() + delta);
  return out;
}

function normCardio(c: WorkoutWithCardio["cardio_sessions"]) {
  if (!c) return null;
  if (Array.isArray(c)) return c[0] ?? null;
  return c;
}

export default async function RunningDashboardPage() {
  const supabase = await createClient();

  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7);

  const { data: rows } = await supabase
    .schema("wellness")
    .from("workouts")
    .select(
      "id, started_at, title, cardio_sessions(distance_meters, duration_seconds, avg_heart_rate)",
    )
    .eq("kind", "running")
    .gte("started_at", twelveWeeksAgo.toISOString())
    .order("started_at", { ascending: true });
  const runs = (rows ?? []) as WorkoutWithCardio[];

  // Weekly mileage (last 12 weeks)
  const weekMeters = new Map<string, number>();
  {
    const start = startOfWeekUTC(twelveWeeksAgo);
    const cursor = new Date(start);
    while (cursor <= new Date()) {
      weekMeters.set(cursor.toISOString().slice(0, 10), 0);
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }
  let totalMeters = 0;
  for (const w of runs) {
    const c = normCardio(w.cardio_sessions);
    if (!c?.distance_meters) continue;
    const key = startOfWeekUTC(new Date(w.started_at))
      .toISOString()
      .slice(0, 10);
    weekMeters.set(
      key,
      (weekMeters.get(key) ?? 0) + Number(c.distance_meters),
    );
    totalMeters += Number(c.distance_meters);
  }
  const weekEntries = Array.from(weekMeters.entries()).sort(([a], [b]) =>
    a < b ? -1 : 1,
  );
  const weekMileSeries = weekEntries.map(([, m]) => metersToMiles(m));
  const totalMiles = metersToMiles(totalMeters);
  const thisWeekMiles = weekMileSeries[weekMileSeries.length - 1] ?? 0;

  // Recent runs with paces (latest 10).
  const recentWithPace = [...runs].reverse().slice(0, 10);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link
          href="/running"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Running
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          12-week mileage trend, recent paces, and totals.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3 rounded-lg border border-zinc-200 p-4 text-center dark:border-zinc-800">
        <Stat
          label="This week"
          value={`${thisWeekMiles.toFixed(thisWeekMiles >= 10 ? 1 : 2)}`}
          hint="mi"
        />
        <Stat
          label="12-wk total"
          value={`${totalMiles.toFixed(0)}`}
          hint="mi"
        />
        <Stat label="Runs (12w)" value={String(runs.length)} hint="" />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Weekly mileage
        </h2>
        <div className="rounded-lg border border-zinc-200 p-3 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          <Sparkline values={weekMileSeries} width={320} height={70} />
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Weeks {formatDate(weekEntries[0]?.[0] ?? new Date().toISOString())} → now
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Recent paces
        </h2>
        {recentWithPace.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No runs in the last 12 weeks.
          </p>
        ) : (
          <ul className="space-y-1">
            {recentWithPace.map((w) => {
              const c = normCardio(w.cardio_sessions);
              return (
                <li key={w.id}>
                  <Link
                    href={`/log/workout/${w.id}`}
                    className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {w.title ?? "Run"}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDate(w.started_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatMiles(c?.distance_meters)} ·{" "}
                      {formatDuration(c?.duration_seconds)} ·{" "}
                      <span className="font-medium text-zinc-700 dark:text-zinc-200">
                        {formatPace(c?.duration_seconds, c?.distance_meters)}
                      </span>
                      {c?.avg_heart_rate ? ` · ${c.avg_heart_rate} bpm` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {hint}
      </p>
    </div>
  );
}
