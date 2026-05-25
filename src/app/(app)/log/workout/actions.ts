"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  workoutBaseSchema,
  liftingSetSchema,
  cardioSessionSchema,
  mobilityEntrySchema,
} from "@/lib/validation/wellness";
import {
  recordEvent,
  updateEventForDetail,
  deleteEventForDetail,
} from "@/lib/db/events";
import { getUserContext, type FormActionState } from "@/lib/db/session";
import type { SupabaseClient } from "@supabase/supabase-js";

// Lifting sets get serialized client-side into a single JSON hidden input so
// the Server Action gets a clean array rather than trying to zip parallel
// FormData.getAll() calls (which break the moment a checkbox is involved).
const liftingSetsArraySchema = z.array(liftingSetSchema);

// Compute duration in minutes when both ends are present; otherwise null.
function durationMinutes(start: Date, end?: Date | null): number | null {
  if (!end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

// Human-readable summary the timeline displays.
function buildWorkoutSummary(args: {
  kind: string;
  durationMinutes: number | null;
  liftingSetCount?: number;
  cardio?: { distance_meters?: number | null; duration_seconds?: number | null } | null;
  mobility?: { focus_area?: string | null; duration_minutes?: number | null } | null;
}): string {
  const parts: string[] = [args.kind];

  if (args.kind === "lifting" && args.liftingSetCount != null) {
    parts.push(`${args.liftingSetCount} set${args.liftingSetCount === 1 ? "" : "s"}`);
  } else if (args.cardio) {
    if (args.cardio.distance_meters != null) {
      const km = (args.cardio.distance_meters / 1000).toFixed(2);
      parts.push(`${km} km`);
    }
    if (args.cardio.duration_seconds != null) {
      const m = Math.floor(args.cardio.duration_seconds / 60);
      const s = args.cardio.duration_seconds % 60;
      parts.push(`${m}:${s.toString().padStart(2, "0")}`);
    }
  } else if (args.mobility) {
    if (args.mobility.focus_area) parts.push(args.mobility.focus_area);
    if (args.mobility.duration_minutes != null) parts.push(`${args.mobility.duration_minutes} min`);
  } else if (args.durationMinutes != null) {
    parts.push(`${args.durationMinutes} min`);
  }

  return parts.join(" · ");
}

// Insert the kind-specific child row when relevant. Lifting bulk-inserts the
// whole sets array.
async function writeKindDetail(
  supabase: SupabaseClient,
  ctx: { userId: string; sourceId: string },
  workoutId: string,
  kind: string,
  fd: FormData,
): Promise<{
  error?: string;
  liftingSetCount?: number;
  cardio?: { distance_meters?: number | null; duration_seconds?: number | null } | null;
  mobility?: { focus_area?: string | null; duration_minutes?: number | null } | null;
}> {
  if (kind === "lifting") {
    const json = (fd.get("lifting_sets_json") as string | null) ?? "[]";
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return { error: "Lifting sets payload was malformed." };
    }
    const parsed = liftingSetsArraySchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Lifting set validation failed." };
    }
    const sets = parsed.data;
    if (sets.length === 0) {
      // Lifting with zero sets is allowed - maybe the user starts the
      // session record before filling sets in. Just skip child insert.
      return { liftingSetCount: 0 };
    }

    // Resolve exercise names against the user's library so sets get linked
    // to wellness.exercises.id when the name matches. Case-insensitive
    // match. Free-text names that don't match a library row still save,
    // with exercise_id NULL - that's allowed by the CHECK constraint.
    const { data: libExercises } = await supabase
      .schema("wellness")
      .from("exercises")
      .select("id, name")
      .eq("user_id", ctx.userId);
    const libByName = new Map(
      (libExercises ?? []).map((e) => [
        e.name.trim().toLowerCase(),
        e.id as string,
      ]),
    );

    const { error } = await supabase
      .schema("wellness")
      .from("lifting_sets")
      .insert(
        sets.map((s) => ({
          user_id: ctx.userId,
          source_id: ctx.sourceId,
          workout_id: workoutId,
          exercise_id:
            libByName.get(s.exercise_name.trim().toLowerCase()) ?? null,
          exercise_name: s.exercise_name,
          set_number: s.set_number,
          reps: s.reps ?? null,
          weight_lbs: s.weight_lbs ?? null,
          rpe: s.rpe ?? null,
          rir: s.rir ?? null,
          tempo: s.tempo ?? null,
          is_warmup: s.is_warmup,
          notes: s.notes ?? null,
        })),
      );
    if (error) return { error: error.message };
    return { liftingSetCount: sets.length };
  }

  if (
    kind === "running" ||
    kind === "cycling" ||
    kind === "swimming" ||
    kind === "walk"
  ) {
    const cardio = cardioSessionSchema.safeParse(Object.fromEntries(fd));
    if (!cardio.success) {
      return { error: cardio.error.issues[0]?.message ?? "Cardio fields failed validation." };
    }
    const c = cardio.data;
    const { error } = await supabase
      .schema("wellness")
      .from("cardio_sessions")
      .insert({
        user_id: ctx.userId,
        source_id: ctx.sourceId,
        workout_id: workoutId,
        distance_meters: c.distance_meters ?? null,
        duration_seconds: c.duration_seconds ?? null,
        avg_heart_rate: c.avg_heart_rate ?? null,
        max_heart_rate: c.max_heart_rate ?? null,
        elevation_gain_meters: c.elevation_gain_meters ?? null,
        route_notes: c.route_notes ?? null,
        shoe_id: c.shoe_id ?? null,
      });
    if (error) return { error: error.message };
    return {
      cardio: {
        distance_meters: c.distance_meters ?? null,
        duration_seconds: c.duration_seconds ?? null,
      },
    };
  }

  if (kind === "mobility") {
    const mob = mobilityEntrySchema.safeParse(Object.fromEntries(fd));
    if (!mob.success) {
      return { error: mob.error.issues[0]?.message ?? "Mobility fields failed validation." };
    }
    const m = mob.data;
    const { error } = await supabase
      .schema("wellness")
      .from("mobility_entries")
      .insert({
        user_id: ctx.userId,
        source_id: ctx.sourceId,
        workout_id: workoutId,
        focus_area: m.focus_area ?? null,
        protocol: m.protocol ?? null,
        duration_minutes: m.duration_minutes ?? null,
      });
    if (error) return { error: error.message };
    return {
      mobility: {
        focus_area: m.focus_area ?? null,
        duration_minutes: m.duration_minutes ?? null,
      },
    };
  }

  // sport / other: no detail row.
  return {};
}

export async function createWorkout(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = workoutBaseSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const w = parsed.data;

  // Insert the parent workout first so we have an id for child rows.
  const { data: workout, error } = await ctx.supabase
    .schema("wellness")
    .from("workouts")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      started_at: w.started_at.toISOString(),
      ended_at: w.ended_at ? w.ended_at.toISOString() : null,
      kind: w.kind,
      title: w.title ?? null,
      perceived_effort: w.perceived_effort ?? null,
      notes: w.notes ?? null,
      location: w.location ?? null,
    })
    .select("id")
    .single();
  if (error || !workout) return { ok: false, banner: error?.message ?? "Save failed." };

  // Write kind-specific child rows.
  const detail = await writeKindDetail(ctx.supabase, ctx, workout.id, w.kind, fd);
  if (detail.error) {
    // Roll back the parent so we don't leave a workout with no detail.
    await ctx.supabase.schema("wellness").from("workouts").delete().eq("id", workout.id);
    return { ok: false, banner: detail.error };
  }

  const dur = durationMinutes(w.started_at, w.ended_at);
  const summary = buildWorkoutSummary({
    kind: w.kind,
    durationMinutes: dur,
    liftingSetCount: detail.liftingSetCount,
    cardio: detail.cardio,
    mobility: detail.mobility,
  });

  const { error: evtErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "workout",
    occurredAt: w.started_at.toISOString(),
    durationMinutes: dur,
    detailTable: "wellness.workouts",
    detailId: workout.id,
    title: w.title ?? w.kind.charAt(0).toUpperCase() + w.kind.slice(1),
    summary,
  });
  if (evtErr) {
    return {
      ok: false,
      banner: `Workout saved but event sync failed: ${evtErr.message}`,
    };
  }

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/workout/${workout.id}?flash=created`);
}

export async function updateWorkout(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = workoutBaseSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const w = parsed.data;

  // Wipe + reinsert the kind-specific children rather than diffing. Simple
  // and correct; a workout's children are small enough that the round trips
  // don't matter.
  await ctx.supabase.schema("wellness").from("lifting_sets").delete().eq("workout_id", id);
  await ctx.supabase.schema("wellness").from("cardio_sessions").delete().eq("workout_id", id);
  await ctx.supabase.schema("wellness").from("mobility_entries").delete().eq("workout_id", id);

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("workouts")
    .update({
      started_at: w.started_at.toISOString(),
      ended_at: w.ended_at ? w.ended_at.toISOString() : null,
      kind: w.kind,
      title: w.title ?? null,
      perceived_effort: w.perceived_effort ?? null,
      notes: w.notes ?? null,
      location: w.location ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message };

  const detail = await writeKindDetail(ctx.supabase, ctx, id, w.kind, fd);
  if (detail.error) return { ok: false, banner: detail.error };

  const dur = durationMinutes(w.started_at, w.ended_at);
  const summary = buildWorkoutSummary({
    kind: w.kind,
    durationMinutes: dur,
    liftingSetCount: detail.liftingSetCount,
    cardio: detail.cardio,
    mobility: detail.mobility,
  });

  await updateEventForDetail(ctx.supabase, {
    detailTable: "wellness.workouts",
    detailId: id,
    occurredAt: w.started_at.toISOString(),
    durationMinutes: dur,
    title: w.title ?? w.kind.charAt(0).toUpperCase() + w.kind.slice(1),
    summary,
  });

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/workout/${id}?flash=updated`);
}

export async function deleteWorkout(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await deleteEventForDetail(ctx.supabase, {
    detailTable: "wellness.workouts",
    detailId: id,
  });
  // Children cascade on the workout's ON DELETE CASCADE.
  await ctx.supabase.schema("wellness").from("workouts").delete().eq("id", id);
  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log?flash=deleted");
}
