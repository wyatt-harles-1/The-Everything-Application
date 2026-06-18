// Server Actions for the gym-mode session UI at /lifting/session/[id].
//
// Each action is small + targeted: log a set's values, mark complete /
// un-complete, add a set, add an exercise mid-workout, remove a set, finish
// the workout. The session page does an optimistic UI update + calls the
// matching action, which writes immediately so a dropped phone or browser
// crash doesn't lose progress.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getUserContext } from "@/lib/db/session";
import { recordEvent } from "@/lib/db/events";

// ---- start a blank session -----------------------------------------------

// Creates a wellness.workouts row with kind=lifting, started_at=now,
// emits a 'workout' event, and redirects to the gym-mode UI. No template,
// no pre-filled sets - user adds exercises + sets as they go.
export async function startBlankSession(): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // Auto-tag with the currently-active mesocycle if one exists. The partial
  // unique index on (user_id) WHERE ended_at IS NULL guarantees at most one,
  // so this is a single-row lookup.
  const { data: activeMeso } = await ctx.supabase
    .schema("wellness")
    .from("mesocycles")
    .select("id")
    .is("ended_at", null)
    .maybeSingle();

  const startedAt = new Date().toISOString();
  const { data: workout, error } = await ctx.supabase
    .schema("wellness")
    .from("workouts")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      started_at: startedAt,
      kind: "lifting",
      title: "Lifting session",
      mesocycle_id: activeMeso?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !workout) redirect("/lifting/start?flash=failed");

  await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "workout",
    occurredAt: startedAt,
    detailTable: "wellness.workouts",
    detailId: workout.id,
    title: "Lifting session",
    summary: "lifting",
  });

  revalidatePath("/lifting");
  revalidatePath("/log");
  redirect(`/lifting/session/${workout.id}`);
}

// ---- set-level edits ------------------------------------------------------

export async function updateSetValues(
  setId: string,
  values: {
    reps?: string;
    weight_lbs?: string;
    rpe?: string;
    rir?: string;
    tempo?: string;
  },
): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const parseNum = (s: string | undefined): number | null => {
    if (s === undefined || s === null || s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const parseText = (s: string | undefined): string | null =>
    s === undefined || s === null || s.trim() === "" ? null : s.trim();

  // Build the patch dynamically so each field only writes when the caller
  // actually included it - the gym-mode UI fires this per blurred input,
  // so an unrelated field shouldn't get nulled out.
  const patch: Record<string, number | string | null> = {};
  if ("reps" in values) patch.reps = parseNum(values.reps);
  if ("weight_lbs" in values) patch.weight_lbs = parseNum(values.weight_lbs);
  if ("rpe" in values) patch.rpe = parseNum(values.rpe);
  if ("rir" in values) patch.rir = parseNum(values.rir);
  if ("tempo" in values) patch.tempo = parseText(values.tempo);

  if (Object.keys(patch).length === 0) return;

  await ctx.supabase
    .schema("wellness")
    .from("lifting_sets")
    .update(patch)
    .eq("id", setId);
}

export async function toggleSetComplete(
  setId: string,
  // Caller passes the new state - the client knows it already since it
  // optimistically toggled.
  complete: boolean,
): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("wellness")
    .from("lifting_sets")
    .update({ completed_at: complete ? new Date().toISOString() : null })
    .eq("id", setId);
}

export async function deleteSet(setId: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("wellness")
    .from("lifting_sets")
    .delete()
    .eq("id", setId);
}

// ---- adding things mid-workout -------------------------------------------

export async function addSetForExercise(
  workoutId: string,
  // Identifies the exercise. Either the library id OR the free-text name
  // (used by the original lifting_sets pattern).
  exercise: { id: string | null; name: string },
): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // Pick the next set_number for this exercise within the workout.
  const { data: existing } = await ctx.supabase
    .schema("wellness")
    .from("lifting_sets")
    .select("set_number")
    .eq("workout_id", workoutId)
    .eq("exercise_name", exercise.name)
    .order("set_number", { ascending: false })
    .limit(1);
  const nextSetNumber = (existing?.[0]?.set_number ?? 0) + 1;

  // Carry forward the previous set's weight + reps + tempo so the user only
  // has to adjust if they're changing. Strong-app behavior. RPE + RIR are
  // intentionally NOT carried over - those reflect how hard the last set
  // was, not a prescription for the next.
  const { data: lastSet } = await ctx.supabase
    .schema("wellness")
    .from("lifting_sets")
    .select("reps, weight_lbs, tempo")
    .eq("workout_id", workoutId)
    .eq("exercise_name", exercise.name)
    .order("set_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  await ctx.supabase
    .schema("wellness")
    .from("lifting_sets")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      workout_id: workoutId,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      set_number: nextSetNumber,
      reps: lastSet?.reps ?? null,
      weight_lbs: lastSet?.weight_lbs ?? null,
      tempo: lastSet?.tempo ?? null,
      is_warmup: false,
    });
}

export async function addExerciseToSession(
  workoutId: string,
  exerciseName: string,
): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // Match to library by name (case-insensitive) if it exists. Otherwise
  // exercise_id stays null and we keep just the free-text.
  const { data: lib } = await ctx.supabase
    .schema("wellness")
    .from("exercises")
    .select("id, name")
    .eq("user_id", ctx.userId)
    .ilike("name", exerciseName.trim());
  const exerciseId = lib?.[0]?.id ?? null;
  const resolvedName = lib?.[0]?.name ?? exerciseName.trim();

  await ctx.supabase
    .schema("wellness")
    .from("lifting_sets")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      exercise_name: resolvedName,
      set_number: 1,
      is_warmup: false,
    });
}

// ---- finish the session --------------------------------------------------

// Set ended_at + bump the matching event row so the timeline shows the
// duration once the user closes the session.
export async function finishSession(workoutId: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const endedAt = new Date().toISOString();
  const { data: w } = await ctx.supabase
    .schema("wellness")
    .from("workouts")
    .select("started_at, title")
    .eq("id", workoutId)
    .maybeSingle();
  if (!w) redirect("/lifting");

  await ctx.supabase
    .schema("wellness")
    .from("workouts")
    .update({ ended_at: endedAt })
    .eq("id", workoutId);

  // Update the timeline event with the computed duration + set summary.
  const start = new Date(w.started_at);
  const end = new Date(endedAt);
  const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

  const { count: setCount } = await ctx.supabase
    .schema("wellness")
    .from("lifting_sets")
    .select("*", { count: "exact", head: true })
    .eq("workout_id", workoutId)
    .not("completed_at", "is", null);

  await ctx.supabase.schema("shared").rpc("update_event_for_detail", {
    p_detail_table: "wellness.workouts",
    p_detail_id: workoutId,
    p_duration_minutes: durationMinutes,
    p_summary: `lifting · ${setCount ?? 0} set${setCount === 1 ? "" : "s"} · ${durationMinutes} min`,
  });

  revalidatePath("/lifting");
  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/workout/${workoutId}?flash=updated`);
}
