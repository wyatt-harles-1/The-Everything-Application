// /lifting/dashboard - rough analytics for the last 12 weeks: volume per
// muscle group (this week), weekly volume trend, and PRs from the last 30
// days. Server-side aggregation in JS (no SQL views needed) because the
// query window is small.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/Sparkline";
import { formatDate } from "@/lib/format";

type RawSet = {
  id: string;
  exercise_id: string | null;
  weight_lbs: number | null;
  reps: number | null;
  e1rm_lbs: string | number | null;
  completed_at: string;
  workout_id: string;
  exercises: { name: string; muscle_group: string | null } | { name: string; muscle_group: string | null }[] | null;
};

function normalizeExercise(
  e: RawSet["exercises"],
): { name: string; muscle_group: string | null } | null {
  if (!e) return null;
  if (Array.isArray(e)) return e[0] ?? null;
  return e;
}

function startOfWeekUTC(d: Date): Date {
  // Monday-anchored UTC weeks. Sunday's weekday=0 -> shift to -6 to land on
  // the prior Monday.
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = out.getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  out.setUTCDate(out.getUTCDate() + delta);
  return out;
}

export default async function LiftingDashboardPage() {
  const supabase = await createClient();

  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7);

  // Pull every completed set from the window, joined to its exercise for
  // muscle_group / name. RLS scopes to current user.
  const { data: rawSets } = await supabase
    .schema("wellness")
    .from("lifting_sets")
    .select(
      "id, exercise_id, weight_lbs, reps, e1rm_lbs, completed_at, workout_id, exercises:exercise_id(name, muscle_group)",
    )
    .not("completed_at", "is", null)
    .gte("completed_at", twelveWeeksAgo.toISOString())
    .order("completed_at", { ascending: true });

  const sets: RawSet[] = (rawSets ?? []) as RawSet[];

  // ---- This week's volume per muscle group --------------------------------
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const volumeByMuscle = new Map<string, number>();
  for (const s of sets) {
    if (new Date(s.completed_at) < weekAgo) continue;
    if (s.weight_lbs == null || s.reps == null) continue;
    const ex = normalizeExercise(s.exercises);
    const group = ex?.muscle_group ?? "ungrouped";
    const vol = Number(s.weight_lbs) * s.reps;
    volumeByMuscle.set(group, (volumeByMuscle.get(group) ?? 0) + vol);
  }
  const muscleBars = Array.from(volumeByMuscle.entries())
    .sort(([, a], [, b]) => b - a);
  const muscleMax = Math.max(0, ...muscleBars.map(([, v]) => v));

  // ---- Weekly volume trend (last 12 weeks) -------------------------------
  const weekTotals = new Map<string, number>();
  // Pre-seed all 12 weeks (Mondays) so empty weeks render as zero rather
  // than gaps in the sparkline.
  {
    const start = startOfWeekUTC(twelveWeeksAgo);
    const cursor = new Date(start);
    while (cursor <= new Date()) {
      weekTotals.set(cursor.toISOString().slice(0, 10), 0);
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }
  for (const s of sets) {
    if (s.weight_lbs == null || s.reps == null) continue;
    const key = startOfWeekUTC(new Date(s.completed_at)).toISOString().slice(0, 10);
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + Number(s.weight_lbs) * s.reps);
  }
  const weekSeries = Array.from(weekTotals.entries()).sort(([a], [b]) =>
    a < b ? -1 : 1,
  );
  const weekSeriesValues = weekSeries.map(([, v]) => v);
  const totalLast12 = weekSeriesValues.reduce((s, n) => s + n, 0);
  const thisWeekVolume = weekSeriesValues[weekSeriesValues.length - 1] ?? 0;

  // ---- Recent PRs (last 30 days) -----------------------------------------
  // Group by exercise_id, find best e1RM in entire history (small N -
  // one query per distinct exercise), then mark sets that match.
  const exerciseIds = new Set<string>();
  for (const s of sets) if (s.exercise_id) exerciseIds.add(s.exercise_id);

  const bestByExercise = new Map<string, number>();
  for (const eid of exerciseIds) {
    const { data: best } = await supabase
      .schema("wellness")
      .from("lifting_sets")
      .select("e1rm_lbs")
      .eq("exercise_id", eid)
      .not("completed_at", "is", null)
      .not("e1rm_lbs", "is", null)
      .order("e1rm_lbs", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (best?.e1rm_lbs != null) {
      bestByExercise.set(eid, Number(best.e1rm_lbs));
    }
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentPRs: Array<{
    setId: string;
    workoutId: string;
    exerciseName: string;
    e1rm: number;
    weight: number | null;
    reps: number | null;
    completedAt: string;
  }> = [];
  for (const s of sets) {
    if (!s.exercise_id) continue;
    if (s.e1rm_lbs == null) continue;
    if (new Date(s.completed_at) < thirtyDaysAgo) continue;
    const best = bestByExercise.get(s.exercise_id);
    if (best == null) continue;
    if (Number(s.e1rm_lbs) < best) continue;
    const ex = normalizeExercise(s.exercises);
    recentPRs.push({
      setId: s.id,
      workoutId: s.workout_id,
      exerciseName: ex?.name ?? "(unknown)",
      e1rm: Number(s.e1rm_lbs),
      weight: s.weight_lbs != null ? Number(s.weight_lbs) : null,
      reps: s.reps,
      completedAt: s.completed_at,
    });
  }
  // Dedupe: if an exercise has multiple tied PRs in the window, keep the
  // most recent one.
  const seenExercise = new Set<string>();
  const dedupedPRs = recentPRs
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .filter((p) => {
      if (seenExercise.has(p.exerciseName)) return false;
      seenExercise.add(p.exerciseName);
      return true;
    });

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link href="/lifting" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Lifting
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Volume (weight × reps), weekly trends, and PRs from the last month.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            This week by muscle group
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            total <span className="font-medium text-zinc-950 dark:text-zinc-50">{Math.round(thisWeekVolume).toLocaleString()}</span> lbs
          </p>
        </div>
        {muscleBars.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No completed sets in the last 7 days.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {muscleBars.map(([group, vol]) => (
              <li key={group}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium">
                    {group === "ungrouped" ? "Other" : group.replace("_", " ")}
                  </span>
                  <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                    {Math.round(vol).toLocaleString()} lbs
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full bg-zinc-950 dark:bg-zinc-50"
                    style={{
                      width: `${muscleMax > 0 ? Math.round((vol / muscleMax) * 100) : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Weekly volume trend
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            12-week total <span className="font-medium text-zinc-950 dark:text-zinc-50">{Math.round(totalLast12).toLocaleString()}</span> lbs
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          <Sparkline values={weekSeriesValues} width={320} height={70} />
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Weeks {formatDate(weekSeries[0]?.[0] ?? new Date().toISOString())} → now
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Recent PRs (last 30 days)
        </h2>
        {dedupedPRs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No new PRs in the last 30 days. (Or no sets have an
            exercise_id yet - try logging via the library autocomplete.)
          </p>
        ) : (
          <ul className="space-y-1">
            {dedupedPRs.map((p) => (
              <li key={p.setId}>
                <Link
                  href={`/log/workout/${p.workoutId}`}
                  className="block rounded-md border border-amber-200 bg-amber-50/60 p-3 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 dark:hover:bg-amber-950/70"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      🏆 {p.exerciseName}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-300">
                      {formatDate(p.completedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {p.weight ?? "?"} × {p.reps ?? "?"} · e1RM{" "}
                    <span className="font-medium">{p.e1rm.toFixed(1)} lbs</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
