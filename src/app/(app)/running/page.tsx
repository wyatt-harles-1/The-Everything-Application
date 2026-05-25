// /running - module hub. Recent runs, this-week mileage, nav cards into
// dashboard + shoes. Mirrors the shape of /lifting.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  formatMiles,
  formatDuration,
  formatPace,
  metersToMiles,
} from "@/lib/running/format";

export default async function RunningHubPage() {
  const supabase = await createClient();

  // Recent running sessions: workouts of kind=running joined with their
  // cardio_sessions detail row for distance/duration/pace.
  const { data: recent } = await supabase
    .schema("wellness")
    .from("workouts")
    .select(
      "id, started_at, title, cardio:cardio_sessions(distance_meters, duration_seconds, avg_heart_rate)",
    )
    .eq("kind", "running")
    .order("started_at", { ascending: false })
    .limit(5);

  type WorkoutRow = {
    id: string;
    started_at: string;
    title: string | null;
    cardio:
      | {
          distance_meters: number | null;
          duration_seconds: number | null;
          avg_heart_rate: number | null;
        }
      | {
          distance_meters: number | null;
          duration_seconds: number | null;
          avg_heart_rate: number | null;
        }[]
      | null;
  };

  function normCardio(c: WorkoutRow["cardio"]) {
    if (!c) return null;
    if (Array.isArray(c)) return c[0] ?? null;
    return c;
  }

  // This-week mileage: sum distance for runs since Monday.
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  const dow = monday.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + delta);

  const { data: thisWeekRuns } = await supabase
    .schema("wellness")
    .from("workouts")
    .select("id, cardio:cardio_sessions(distance_meters)")
    .eq("kind", "running")
    .gte("started_at", monday.toISOString());
  let weekMeters = 0;
  for (const r of thisWeekRuns ?? []) {
    const c = Array.isArray(r.cardio) ? r.cardio[0] : r.cardio;
    if (c?.distance_meters != null) weekMeters += Number(c.distance_meters);
  }
  const weekMiles = metersToMiles(weekMeters);

  // Active shoe count for the hub card sublabel.
  const { count: activeShoeCount } = await supabase
    .schema("wellness")
    .from("shoes")
    .select("*", { count: "exact", head: true })
    .is("retired_at", null);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Home
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Running
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Runs from /log feed this page. Mileage trends + per-shoe
          rotation live here.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          This week
        </p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">
          {weekMiles.toFixed(weekMiles >= 10 ? 1 : 2)}
          <span className="ml-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            mi
          </span>
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {(thisWeekRuns ?? []).length} run
          {(thisWeekRuns ?? []).length === 1 ? "" : "s"}
        </p>
      </section>

      <Link
        href="/log/workout/new?kind=running"
        className="block min-h-12 w-full rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Log a run →
      </Link>

      <section className="grid grid-cols-2 gap-3">
        <HubCard
          href="/running/dashboard"
          label="Dashboard"
          sublabel="trends + paces"
        />
        <HubCard
          href="/running/shoes"
          label="Shoes"
          sublabel={
            activeShoeCount && activeShoeCount > 0
              ? `${activeShoeCount} active`
              : "track mileage"
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Recent runs
        </h2>
        {!recent || recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No runs logged yet. Log one to see it here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {(recent as WorkoutRow[]).map((w) => {
              const c = normCardio(w.cardio);
              return (
                <li
                  key={w.id}
                  className="rounded-md border border-zinc-200 dark:border-zinc-800"
                >
                  <Link
                    href={`/log/workout/${w.id}`}
                    className="block p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {w.title ?? "Run"}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDateTime(w.started_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatMiles(c?.distance_meters)} ·{" "}
                      {formatDuration(c?.duration_seconds)} ·{" "}
                      {formatPace(c?.duration_seconds, c?.distance_meters)}
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

function HubCard({
  href,
  label,
  sublabel,
}: {
  href: string;
  label: string;
  sublabel: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-3 text-center shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {sublabel}
      </span>
    </Link>
  );
}
