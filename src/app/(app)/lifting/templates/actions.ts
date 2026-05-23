// Server Actions for /lifting/templates.
// Builder form submits a JSON blob (name + description + ordered exercises
// with their planned_sets arrays). Server parses, validates with Zod, then
// transactionally inserts the template + template_exercises rows.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { workoutTemplateSchema } from "@/lib/validation/wellness";
import {
  getUserContext,
  captureValues,
  type FormActionState,
} from "@/lib/db/session";
import type { SupabaseClient } from "@supabase/supabase-js";

// Server Action that creates a wellness.workouts row pre-filled from the
// template + copies every planned set into lifting_sets. Redirects to the
// workout's edit page so the user can adjust as they actually train.
// (The dedicated /lifting/session/[id] gym-mode UX ships in Wave 3; until
//  then the existing /log/workout/[id] form is the live-edit surface.)

// Helper: resolve a typed exercise_name back to an exercise_id from the
// user's library so the linked rows feed PR / history queries. Case-insens.
async function buildExerciseNameLookup(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .schema("wellness")
    .from("exercises")
    .select("id, name")
    .eq("user_id", userId);
  return new Map(
    (data ?? []).map((e: { id: string; name: string }) => [
      e.name.trim().toLowerCase(),
      e.id,
    ]),
  );
}

function bannerFor(fieldErrors: Record<string, string[] | undefined>): string {
  const names = Object.entries(fieldErrors)
    .filter(([, v]) => v && v.length)
    .map(([k]) => k);
  if (names.length === 0) return "Fix the highlighted fields below.";
  return `Fix the ${names.join(", ")} field${names.length === 1 ? "" : "s"} below.`;
}

export async function createTemplate(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  // The builder posts one big JSON blob in this field; the scalar text
  // fields are also in FormData (so `values` carries them for re-hydrate).
  let raw: unknown;
  try {
    raw = JSON.parse((fd.get("template_json") as string | null) ?? "{}");
  } catch {
    return { ok: false, banner: "Template payload was malformed.", values };
  }
  const parsed = workoutTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      banner: bannerFor(parsed.error.flatten().fieldErrors),
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  const t = parsed.data;

  const { data: template, error: templateErr } = await ctx.supabase
    .schema("wellness")
    .from("workout_templates")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      name: t.name,
      description: t.description ?? null,
      notes: t.notes ?? null,
    })
    .select("id")
    .single();
  if (templateErr || !template) {
    const msg =
      templateErr?.code === "23505"
        ? `You already have a template named "${t.name}".`
        : (templateErr?.message ?? "Failed to save template.");
    return { ok: false, banner: msg, values };
  }

  // Resolve any free-text exercise names to library ids.
  const lookup = await buildExerciseNameLookup(ctx.supabase, ctx.userId);

  if (t.exercises.length > 0) {
    const { error: exErr } = await ctx.supabase
      .schema("wellness")
      .from("template_exercises")
      .insert(
        t.exercises.map((e) => ({
          user_id: ctx.userId,
          source_id: ctx.sourceId,
          template_id: template.id,
          exercise_id: lookup.get(e.exercise_name.trim().toLowerCase()) ?? null,
          exercise_name: e.exercise_name,
          position: e.position,
          planned_sets: e.planned_sets,
          rest_seconds: e.rest_seconds ?? null,
          notes: e.notes ?? null,
        })),
      );
    if (exErr) {
      // Roll back parent so we don't leave a templates row with no body.
      await ctx.supabase
        .schema("wellness")
        .from("workout_templates")
        .delete()
        .eq("id", template.id);
      return { ok: false, banner: exErr.message, values };
    }
  }

  revalidatePath("/lifting/templates");
  redirect(`/lifting/templates/${template.id}?flash=created`);
}

export async function updateTemplate(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  let raw: unknown;
  try {
    raw = JSON.parse((fd.get("template_json") as string | null) ?? "{}");
  } catch {
    return { ok: false, banner: "Template payload was malformed.", values };
  }
  const parsed = workoutTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      banner: bannerFor(parsed.error.flatten().fieldErrors),
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }
  const t = parsed.data;

  const { error: updErr } = await ctx.supabase
    .schema("wellness")
    .from("workout_templates")
    .update({
      name: t.name,
      description: t.description ?? null,
      notes: t.notes ?? null,
    })
    .eq("id", id);
  if (updErr) {
    const msg =
      updErr.code === "23505"
        ? `You already have a template named "${t.name}".`
        : updErr.message;
    return { ok: false, banner: msg, values };
  }

  // Wipe + reinsert child rows (same pattern as the workout edit flow).
  await ctx.supabase
    .schema("wellness")
    .from("template_exercises")
    .delete()
    .eq("template_id", id);

  const lookup = await buildExerciseNameLookup(ctx.supabase, ctx.userId);
  if (t.exercises.length > 0) {
    await ctx.supabase
      .schema("wellness")
      .from("template_exercises")
      .insert(
        t.exercises.map((e) => ({
          user_id: ctx.userId,
          source_id: ctx.sourceId,
          template_id: id,
          exercise_id: lookup.get(e.exercise_name.trim().toLowerCase()) ?? null,
          exercise_name: e.exercise_name,
          position: e.position,
          planned_sets: e.planned_sets,
          rest_seconds: e.rest_seconds ?? null,
          notes: e.notes ?? null,
        })),
      );
  }

  revalidatePath("/lifting/templates");
  revalidatePath(`/lifting/templates/${id}`);
  redirect(`/lifting/templates/${id}?flash=updated`);
}

export async function deleteTemplate(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  // template_exercises rows cascade via FK ON DELETE CASCADE.
  await ctx.supabase
    .schema("wellness")
    .from("workout_templates")
    .delete()
    .eq("id", id);
  revalidatePath("/lifting/templates");
  redirect("/lifting/templates?flash=deleted");
}

// "Start session from template": copy the template + its planned_sets into
// a new live workout. The workout opens in the existing /log/workout/[id]
// editor (Wave 3 will add /lifting/session/[id] for in-gym execution).
export async function startSessionFromTemplate(templateId: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const { data: template, error: tErr } = await ctx.supabase
    .schema("wellness")
    .from("workout_templates")
    .select("name, notes")
    .eq("id", templateId)
    .maybeSingle();
  if (tErr || !template) redirect("/lifting/templates?flash=not_found");

  // Auto-tag with the active mesocycle if one exists.
  const { data: activeMeso } = await ctx.supabase
    .schema("wellness")
    .from("mesocycles")
    .select("id")
    .is("ended_at", null)
    .maybeSingle();

  // Insert the workout row first to get a workout_id for the children.
  const startedAt = new Date().toISOString();
  const { data: workout, error: wErr } = await ctx.supabase
    .schema("wellness")
    .from("workouts")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      started_at: startedAt,
      kind: "lifting",
      title: template.name,
      notes: template.notes ?? null,
      mesocycle_id: activeMeso?.id ?? null,
    })
    .select("id")
    .single();
  if (wErr || !workout) {
    redirect("/lifting/templates?flash=start_failed");
  }

  // Emit a 'workout' event so the timeline picks it up immediately.
  await ctx.supabase.schema("shared").rpc("record_event", {
    p_user_id: ctx.userId,
    p_source_id: ctx.sourceId,
    p_domain: "wellness",
    p_event_type: "workout",
    p_occurred_at: startedAt,
    p_detail_table: "wellness.workouts",
    p_detail_id: workout.id,
    p_title: template.name,
    p_summary: `lifting (from "${template.name}")`,
    p_metadata: { source_template_id: templateId },
  });

  // Pull all template exercises in order, then unroll their planned_sets
  // into wellness.lifting_sets rows. Set numbers are 1-indexed per exercise.
  const { data: rows } = await ctx.supabase
    .schema("wellness")
    .from("template_exercises")
    .select("exercise_id, exercise_name, planned_sets, position, notes")
    .eq("template_id", templateId)
    .order("position", { ascending: true });

  const setsToInsert: Record<string, unknown>[] = [];
  for (const r of rows ?? []) {
    const planned = (r.planned_sets ?? []) as Array<{
      reps?: number | null;
      weight_lbs?: number | null;
      rpe?: number | null;
      rir?: number | null;
      tempo?: string | null;
      is_warmup?: boolean;
      notes?: string | null;
    }>;
    planned.forEach((p, i) => {
      setsToInsert.push({
        user_id: ctx.userId,
        source_id: ctx.sourceId,
        workout_id: workout.id,
        exercise_id: r.exercise_id,
        exercise_name: r.exercise_name,
        set_number: i + 1,
        reps: p.reps ?? null,
        weight_lbs: p.weight_lbs ?? null,
        rpe: p.rpe ?? null,
        rir: p.rir ?? null,
        tempo: p.tempo ?? null,
        is_warmup: p.is_warmup ?? false,
        notes: p.notes ?? null,
      });
    });
  }
  if (setsToInsert.length > 0) {
    await ctx.supabase.schema("wellness").from("lifting_sets").insert(setsToInsert);
  }

  revalidatePath("/log");
  revalidatePath("/");
  // Send the user straight into gym-mode for live execution. The
  // /log/workout/[id] editor remains available for retroactive edits.
  redirect(`/lifting/session/${workout.id}`);
}
