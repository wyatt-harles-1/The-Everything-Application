// Gym-mode session UI: a Server Component shell that fetches the workout
// data + last-performance hints, then hands off to the Client Component
// which manages live entry, the rest timer, and per-set Server Action
// calls.

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { SessionClient, type SessionExercise } from "./SessionClient";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: workout, error } = await supabase
    .schema("wellness")
    .from("workouts")
    .select("id, started_at, ended_at, title, kind")
    .eq("id", id)
    .maybeSingle();
  if (error || !workout) notFound();

  const { data: sets } = await supabase
    .schema("wellness")
    .from("lifting_sets")
    .select("id, set_number, exercise_id, exercise_name, reps, weight_lbs, rpe, is_warmup, completed_at")
    .eq("workout_id", id)
    .order("set_number", { ascending: true });

  // Group sets by exercise. Preserve "first appearance" ordering so the
  // session displays exercises in the order the user (or template) put
  // them in.
  const grouped = new Map<string, SessionExercise>();
  const orderKey = (s: { exercise_id: string | null; exercise_name: string | null }) =>
    s.exercise_id ?? `name:${(s.exercise_name ?? "").toLowerCase()}`;

  for (const s of sets ?? []) {
    const key = orderKey(s);
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        exerciseId: s.exercise_id ?? null,
        name: s.exercise_name ?? "Unnamed",
        lastPerformance: null,
        sets: [],
      });
    }
    grouped.get(key)!.sets.push({
      id: s.id,
      setNumber: s.set_number,
      reps: s.reps,
      weightLbs: s.weight_lbs,
      rpe: s.rpe,
      isWarmup: s.is_warmup,
      completedAt: s.completed_at,
    });
  }

  // Last-performance lookups. For each exercise in this session, find the
  // most recent COMPLETED set from a DIFFERENT workout. Loop is OK at the
  // small N we expect (typically 4-10 exercises per session). Skip exercises
  // without a library id (free-text rows have no canonical key to query on).
  for (const ex of grouped.values()) {
    if (!ex.exerciseId) continue;
    const { data: prior } = await supabase
      .schema("wellness")
      .from("lifting_sets")
      .select("reps, weight_lbs, completed_at")
      .eq("exercise_id", ex.exerciseId)
      .not("completed_at", "is", null)
      .neq("workout_id", id)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior) {
      ex.lastPerformance = {
        reps: prior.reps,
        weightLbs: prior.weight_lbs,
        completedAt: prior.completed_at,
      };
    }
  }

  // Library names for the "add exercise" autocomplete.
  const { data: libExercises } = await supabase
    .schema("wellness")
    .from("exercises")
    .select("name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const exerciseNames = (libExercises ?? []).map((e) => e.name);

  return (
    <SessionClient
      workoutId={workout.id}
      startedAt={workout.started_at}
      endedAt={workout.ended_at}
      title={workout.title}
      exercises={Array.from(grouped.values())}
      exerciseNames={exerciseNames}
    />
  );
}
