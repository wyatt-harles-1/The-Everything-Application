// Exercise detail + edit + history.
//
// Top: edit form (reused for create + update).
// Middle: action buttons (archive / unarchive / delete).
// Bottom: history table - every set ever logged for this exercise, newest
//   first. Pulls from wellness.lifting_sets joined with the parent workout's
//   started_at for the date display.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";

import { ExerciseForm } from "../../ExerciseForm";
import {
  updateExercise,
  archiveExercise,
  unarchiveExercise,
  deleteExercise,
} from "../../actions";

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id } = await params;
  const { flash } = await searchParams;

  const supabase = await createClient();
  const { data: exercise, error } = await supabase
    .schema("wellness")
    .from("exercises")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !exercise) notFound();

  // History - every set referencing this exercise. Pull workout dates from
  // wellness.workouts via a join (the FK lifting_sets.workout_id).
  const { data: sets } = await supabase
    .schema("wellness")
    .from("lifting_sets")
    .select(
      "id, set_number, reps, weight_lbs, rpe, rir, tempo, e1rm_lbs, is_warmup, notes, completed_at, workout_id, created_at, workouts:workout_id(id, started_at, title)",
    )
    .eq("exercise_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  // PR is the highest e1RM ever logged on a completed set for this exercise.
  const maxE1rm = (sets ?? [])
    .filter((s) => s.completed_at !== null && s.e1rm_lbs != null)
    .reduce((max, s) => Math.max(max, Number(s.e1rm_lbs)), 0);

  // For the e1RM sparkline: completed sets in chronological order with a
  // non-null e1rm.
  const e1rmSeries = (sets ?? [])
    .filter((s) => s.completed_at !== null && s.e1rm_lbs != null)
    .map((s) => ({
      e1rm: Number(s.e1rm_lbs),
      ts: new Date(s.completed_at!).getTime(),
    }))
    .sort((a, b) => a.ts - b.ts)
    .map((p) => p.e1rm);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link
          href="/lifting/exercises"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Exercises
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {exercise.name}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {[exercise.muscle_group, exercise.equipment]
            .filter(Boolean)
            .join(" · ") || "no metadata"}
          {!exercise.is_active ? " · archived" : ""}
        </p>
      </header>

      {flash === "created" ? <Banner kind="ok">Exercise added ✓</Banner> : null}
      {flash === "updated" ? <Banner kind="ok">Exercise updated ✓</Banner> : null}
      {flash === "restored" ? <Banner kind="ok">Exercise restored.</Banner> : null}

      <ExerciseForm
        action={updateExercise.bind(null, id)}
        submitLabel="Update exercise"
        defaults={{
          name: exercise.name,
          muscle_group: exercise.muscle_group ?? "",
          equipment: exercise.equipment ?? "",
          default_rest_seconds: exercise.default_rest_seconds,
          is_bodyweight: !!exercise.is_bodyweight,
          instructions: exercise.instructions ?? "",
          notes: exercise.notes ?? "",
        }}
      />

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex flex-wrap gap-3">
        {exercise.is_active ? (
          <form action={archiveExercise.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Archive
            </button>
          </form>
        ) : (
          <form action={unarchiveExercise.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Restore
            </button>
          </form>
        )}
        <form action={deleteExercise.bind(null, id)}>
          <button
            type="submit"
            className="min-h-11 rounded-md px-4 py-2 text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Delete permanently
          </button>
        </form>
      </div>

      {/* e1RM trend chart - lit only when we have at least one completed set
          with weight+reps. The Sparkline draws values evenly spaced. */}
      {e1rmSeries.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              e1RM trend
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              best: <span className="font-medium text-zinc-950 dark:text-zinc-50">{maxE1rm.toFixed(1)} lbs</span>
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            <Sparkline values={e1rmSeries} />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {e1rmSeries.length} completed sets · Epley formula
            </p>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          History
        </h2>
        {!sets || sets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No sets logged for this exercise yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {sets.map((s) => {
              // Supabase nested select: depending on the relationship shape
              // and the supabase-js version, `workouts` arrives as an array,
              // a single object, or null. Normalize to a single (or null).
              type WorkoutShape = {
                id: string;
                started_at: string;
                title: string | null;
              };
              const raw = s.workouts as unknown as
                | WorkoutShape
                | WorkoutShape[]
                | null;
              const workout: WorkoutShape | null = Array.isArray(raw)
                ? raw[0] ?? null
                : raw;
              // A set is a PR if it's the current top-e1RM completed set.
              // Ties are fine - multiple equal-best sets all get the badge.
              const isPR =
                s.completed_at !== null &&
                s.e1rm_lbs != null &&
                Number(s.e1rm_lbs) === maxE1rm &&
                maxE1rm > 0;
              return (
                <li key={s.id}>
                  <Link
                    href={workout ? `/log/workout/${workout.id}` : "#"}
                    className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        Set {s.set_number}
                        {isPR ? (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                            🏆 PR
                          </span>
                        ) : null}
                        {s.is_warmup ? " (warmup)" : ""}
                      </span>
                      {workout ? (
                        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDateTime(workout.started_at)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm">
                      {[
                        s.reps != null ? `${s.reps} reps` : null,
                        s.weight_lbs != null
                          ? `${exercise.is_bodyweight ? "+" : ""}${s.weight_lbs} lbs`
                          : null,
                        s.rpe != null ? `RPE ${s.rpe}` : null,
                        s.rir != null ? `RIR ${Number(s.rir)}` : null,
                        s.tempo ? `tempo ${s.tempo}` : null,
                        s.e1rm_lbs != null
                          ? `e1RM ${Number(s.e1rm_lbs).toFixed(1)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                    {s.notes ? (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {s.notes}
                      </p>
                    ) : null}
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

function Banner({
  kind,
  children,
}: {
  kind: "ok" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100";
  return <p className={`rounded-md px-3 py-2 text-sm ${cls}`}>{children}</p>;
}
