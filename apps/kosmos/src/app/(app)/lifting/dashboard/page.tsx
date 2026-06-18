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

// Per-bucket Tailwind background classes for the split bar. Picked from
// the project's existing palette - readable in light + dark mode.
const BUCKET_COLOR: Record<string, string> = {
  push: "bg-sky-500",
  pull: "bg-emerald-500",
  legs: "bg-amber-500",
  core: "bg-violet-500",
  other: "bg-zinc-400 dark:bg-zinc-500",
};

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

  // ---- 4-week body-part split --------------------------------------------
  // Rolling 4-week average volume per muscle group, plus a push/pull/legs
  // categorization so imbalances pop. 4 weeks is a typical mesocycle
  // baseline - RP-style "weekly average" for each group.
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fourWeekVolumeByMuscle = new Map<string, number>();
  for (const s of sets) {
    if (new Date(s.completed_at) < fourWeeksAgo) continue;
    if (s.weight_lbs == null || s.reps == null) continue;
    const ex = normalizeExercise(s.exercises);
    const group = ex?.muscle_group ?? "ungrouped";
    const vol = Number(s.weight_lbs) * s.reps;
    fourWeekVolumeByMuscle.set(
      group,
      (fourWeekVolumeByMuscle.get(group) ?? 0) + vol,
    );
  }
  // Bucket muscle groups into push / pull / legs / core / other for the
  // top-level split. This mirrors how Stronger + most programming apps
  // visualize balance. Mapping reflects how compound lifts contribute -
  // bench/OHP are push, rows/pulls/biceps are pull, etc.
  const SPLIT_BUCKETS: Record<string, string[]> = {
    push: ["chest", "shoulders", "triceps"],
    pull: ["back", "biceps", "forearms"],
    legs: ["quads", "hamstrings", "glutes", "calves"],
    core: ["abs", "obliques", "lower_back"],
  };
  const splitVolumes: Record<string, number> = {
    push: 0,
    pull: 0,
    legs: 0,
    core: 0,
    other: 0,
  };
  for (const [group, vol] of fourWeekVolumeByMuscle.entries()) {
    let bucket = "other";
    for (const [b, members] of Object.entries(SPLIT_BUCKETS)) {
      if (members.includes(group)) {
        bucket = b;
        break;
      }
    }
    splitVolumes[bucket] += vol;
  }
  const splitOrdered = Object.entries(splitVolumes)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  const splitTotal = splitOrdered.reduce((s, [, v]) => s + v, 0);
  // Per-muscle 4-week weekly average for the secondary, finer breakdown.
  const perMuscleWeeklyAvg = Array.from(fourWeekVolumeByMuscle.entries())
    .map(([g, v]) => [g, v / 4] as const)
    .sort(([, a], [, b]) => b - a);
  const perMuscleMax = Math.max(0, ...perMuscleWeeklyAvg.map(([, v]) => v));

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

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            4-week split (push · pull · legs)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {splitTotal > 0
              ? `${Math.round(splitTotal).toLocaleString()} lbs · 28d`
              : "no data"}
          </p>
        </div>
        {splitOrdered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No completed sets in the last 28 days yet. Log a session to see
            balance.
          </p>
        ) : (
          <>
            {/* Stacked single-row bar: at-a-glance push/pull/legs proportion */}
            <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              {splitOrdered.map(([bucket, vol]) => (
                <div
                  key={bucket}
                  className={`h-full ${BUCKET_COLOR[bucket] ?? "bg-zinc-500"}`}
                  style={{
                    width: `${splitTotal > 0 ? (vol / splitTotal) * 100 : 0}%`,
                  }}
                  title={`${bucket}: ${Math.round(vol).toLocaleString()} lbs`}
                />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
              {splitOrdered.map(([bucket, vol]) => (
                <li key={bucket} className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${BUCKET_COLOR[bucket] ?? "bg-zinc-500"}`}
                  />
                  <span className="font-medium capitalize">{bucket}</span>
                  <span className="ml-auto tabular-nums text-zinc-500 dark:text-zinc-400">
                    {Math.round((vol / splitTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
            {perMuscleWeeklyAvg.length > 0 ? (
              <details className="space-y-1.5 pt-1 text-xs">
                <summary className="cursor-pointer text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
                  Per-muscle weekly average →
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {perMuscleWeeklyAvg.map(([group, vol]) => (
                    <li key={group}>
                      <div className="flex items-baseline justify-between">
                        <span className="font-medium">
                          {group === "ungrouped" ? "Other" : group.replace("_", " ")}
                        </span>
                        <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                          {Math.round(vol).toLocaleString()} lbs/wk
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full bg-zinc-700 dark:bg-zinc-300"
                          style={{
                            width: `${perMuscleMax > 0 ? Math.round((vol / perMuscleMax) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
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
