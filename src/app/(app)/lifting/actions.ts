// Server Actions for the lifting module.
//
// Phase 3 Wave 1: exercises CRUD + seed starter. Future waves add templates,
// session actions, etc.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { exerciseSchema } from "@/lib/validation/wellness";
import {
  getUserContext,
  captureValues,
  type FormActionState,
} from "@/lib/db/session";
import { starterExercises } from "@/lib/lifting/starter-exercises";

function bannerFor(fieldErrors: Record<string, string[] | undefined>): string {
  const names = Object.entries(fieldErrors)
    .filter(([, v]) => v && v.length)
    .map(([k]) => k);
  if (names.length === 0) return "Fix the highlighted fields below.";
  return `Fix the ${names.join(", ")} field${names.length === 1 ? "" : "s"} below.`;
}

export async function createExercise(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = exerciseSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const e = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("exercises")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      name: e.name,
      muscle_group: e.muscle_group ?? null,
      equipment: e.equipment ?? null,
      instructions: e.instructions ?? null,
      notes: e.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    // Unique-violation on (user, name) gives a Postgres 23505. Surface a
    // friendlier message than the raw DB error.
    const msg = error?.code === "23505"
      ? `You already have an exercise named "${e.name}".`
      : (error?.message ?? "Failed to save exercise.");
    return { ok: false, banner: msg, values };
  }

  revalidatePath("/lifting/exercises");
  redirect(`/lifting/exercises/${row.id}?flash=created`);
}

export async function updateExercise(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = exerciseSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const e = parsed.data;

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("exercises")
    .update({
      name: e.name,
      muscle_group: e.muscle_group ?? null,
      equipment: e.equipment ?? null,
      instructions: e.instructions ?? null,
      notes: e.notes ?? null,
    })
    .eq("id", id);
  if (error) {
    const msg = error.code === "23505"
      ? `You already have an exercise named "${e.name}".`
      : error.message;
    return { ok: false, banner: msg, values };
  }

  revalidatePath("/lifting/exercises");
  revalidatePath(`/lifting/exercises/${id}`);
  redirect(`/lifting/exercises/${id}?flash=updated`);
}

// Soft-delete via is_active = false rather than DROP. Past lifting_sets keep
// referencing the row (or cached exercise_name) and PR history stays intact.
export async function archiveExercise(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("wellness")
    .from("exercises")
    .update({ is_active: false })
    .eq("id", id);
  revalidatePath("/lifting/exercises");
  redirect("/lifting/exercises?flash=archived");
}

export async function unarchiveExercise(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("wellness")
    .from("exercises")
    .update({ is_active: true })
    .eq("id", id);
  revalidatePath("/lifting/exercises");
  redirect(`/lifting/exercises/${id}?flash=restored`);
}

// Hard-delete is allowed but discouraged. The FK on lifting_sets.exercise_id
// is ON DELETE SET NULL, so past sets keep their cached exercise_name. Still,
// archive is usually preferred.
export async function deleteExercise(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("wellness")
    .from("exercises")
    .delete()
    .eq("id", id);
  revalidatePath("/lifting/exercises");
  redirect("/lifting/exercises?flash=deleted");
}

// Bulk-insert the starter set for users who don't have a library yet.
// Skips any names the user already has (unique constraint would 23505).
export async function seedStarterExercises(): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const { data: existing } = await ctx.supabase
    .schema("wellness")
    .from("exercises")
    .select("name")
    .eq("user_id", ctx.userId);
  const have = new Set((existing ?? []).map((e) => e.name));

  const toInsert = starterExercises
    .filter((s) => !have.has(s.name))
    .map((s) => ({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      name: s.name,
      muscle_group: s.muscle_group,
      equipment: s.equipment,
    }));

  if (toInsert.length > 0) {
    await ctx.supabase.schema("wellness").from("exercises").insert(toInsert);
  }

  revalidatePath("/lifting/exercises");
  redirect(`/lifting/exercises?flash=seeded_${toInsert.length}`);
}
