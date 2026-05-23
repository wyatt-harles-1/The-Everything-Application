// Mesocycle detail page. Shows the editable form, lifecycle actions
// (finish / reopen / delete), and a small stats block: week N of X,
// session count, weekly volume, and PRs that landed during the block.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import {
  computeMesoProgress,
  type MesocycleRow,
} from "@/lib/lifting/mesocycle";

import { MesocycleForm } from "../MesocycleForm";
import {
  updateMesocycle,
  finishMesocycle,
  reopenMesocycle,
  deleteMesocycle,
} from "../actions";

export default async function MesocycleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id } = await params;
  const { flash } = await searchParams;
  const supabase = await createClient();

  const { data: meso, error } = await supabase
    .schema("wellness")
    .from("mesocycles")
    .select(
      "id, name, started_at, planned_weeks, deload_week_number, ended_at, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !meso) notFound();

  const m = meso as MesocycleRow & { notes: string | null };
  const active = m.ended_at === null;
  const progress = active ? computeMesoProgress(m) : null;

  // Workouts tagged to this meso.
  const { data: workouts } = await supabase
    .schema("wellness")
    .from("workouts")
    .select("id, started_at, ended_at, title")
    .eq("mesocycle_id", id)
    .eq("kind", "lifting")
    .order("started_at", { ascending: false });

  const workoutIds = (workouts ?? []).map((w) => w.id);
  const sessionCount = workouts?.length ?? 0;

  // Weekly volume across the block (in lbs). Only completed sets count.
  // Compute server-side in JS - the query window is bounded by the meso.
  const weekVolumes: number[] = new Array(m.planned_weeks).fill(0);
  let totalVolume = 0;
  let totalSets = 0;
  let prCount = 0;
  if (workoutIds.length > 0) {
    const { data: sets } = await supabase
      .schema("wellness")
      .from("lifting_sets")
      .select("weight_lbs, reps, e1rm_lbs, completed_at, exercise_id")
      .in("workout_id", workoutIds)
      .not("completed_at", "is", null);

    const blockStart = new Date(m.started_at + "T00:00:00");
    for (const s of sets ?? []) {
      if (!s.completed_at) continue;
      if (s.weight_lbs == null || s.reps == null) continue;
      const vol = Number(s.weight_lbs) * s.reps;
      totalVolume += vol;
      totalSets += 1;
      const daysIn = Math.floor(
        (new Date(s.completed_at).getTime() - blockStart.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const weekIdx = Math.min(
        m.planned_weeks - 1,
        Math.max(0, Math.floor(daysIn / 7)),
      );
      weekVolumes[weekIdx] += vol;
    }

    // PR count: for each exercise touched in this meso, ask whether any of
    // its sets here hit the all-time top e1RM. Small N (distinct exercises
    // in the block) → one query each is fine.
    const distinctExerciseIds = new Set<string>();
    for (const s of sets ?? []) {
      if (s.exercise_id) distinctExerciseIds.add(s.exercise_id);
    }
    for (const eid of distinctExerciseIds) {
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
      if (best?.e1rm_lbs == null) continue;
      const top = Number(best.e1rm_lbs);
      const hit = (sets ?? []).some(
        (s) =>
          s.exercise_id === eid &&
          s.e1rm_lbs != null &&
          Number(s.e1rm_lbs) >= top,
      );
      if (hit) prCount += 1;
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link
          href="/lifting/mesocycles"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Mesocycles
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {m.name}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatDate(m.started_at)}
          {m.ended_at ? ` → ${formatDate(m.ended_at)}` : " · in progress"}
        </p>
      </header>

      {flash === "created" ? <Banner kind="ok">Mesocycle created ✓</Banner> : null}
      {flash === "updated" ? <Banner kind="ok">Mesocycle updated ✓</Banner> : null}
      {flash === "finished" ? <Banner kind="ok">Block marked complete.</Banner> : null}
      {flash === "reopened" ? <Banner kind="ok">Block reopened.</Banner> : null}
      {flash === "another_active" ? (
        <Banner kind="warn">
          Couldn&apos;t reopen — another block is already active. Finish that
          one first.
        </Banner>
      ) : null}

      {/* Live stats - only when active OR has logged sessions */}
      {progress || sessionCount > 0 ? (
        <section className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat
              label={progress ? "Week" : "Span"}
              value={
                progress
                  ? `${progress.currentWeek}/${m.planned_weeks}`
                  : `${m.planned_weeks} wk`
              }
              hint={progress?.isDeloadWeek ? "deload" : undefined}
            />
            <Stat label="Sessions" value={String(sessionCount)} />
            <Stat label="PRs" value={String(prCount)} />
          </div>
          {weekVolumes.some((v) => v > 0) ? (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Volume per week
                </span>
                <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  total {Math.round(totalVolume).toLocaleString()} lbs ·{" "}
                  {totalSets} set{totalSets === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-1 rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                <Sparkline values={weekVolumes} width={320} height={50} />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <MesocycleForm
        action={updateMesocycle.bind(null, id)}
        submitLabel="Update mesocycle"
        defaults={{
          name: m.name,
          started_at: m.started_at,
          planned_weeks: m.planned_weeks,
          deload_week_number: m.deload_week_number,
          notes: m.notes ?? "",
        }}
      />

      <div className="flex flex-wrap gap-3">
        {active ? (
          <form action={finishMesocycle.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Finish block
            </button>
          </form>
        ) : (
          <form action={reopenMesocycle.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Reopen
            </button>
          </form>
        )}
        <form action={deleteMesocycle.bind(null, id)}>
          <button
            type="submit"
            className="min-h-11 rounded-md px-4 py-2 text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Delete permanently
          </button>
        </form>
      </div>

      {workouts && workouts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Sessions in this block
          </h2>
          <ul className="space-y-1">
            {workouts.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/log/workout/${w.id}`}
                  className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {w.title ?? "Lifting session"}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(w.started_at)}
                    </span>
                  </div>
                  {w.ended_at == null ? (
                    <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      In progress
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
          {hint}
        </p>
      ) : null}
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
