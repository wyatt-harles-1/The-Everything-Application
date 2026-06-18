// Server Actions for /lifting/mesocycles. Mesos are user-defined training
// blocks (3-6 weeks of progressive overload, often with a deload week).
// One can be "active" at a time per user, enforced by a partial unique
// index on the table.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { mesocycleSchema } from "@/lib/validation/wellness";
import {
  getUserContext,
  captureValues,
  type FormActionState,
} from "@/lib/db/session";

function bannerFor(fieldErrors: Record<string, string[] | undefined>): string {
  const names = Object.entries(fieldErrors)
    .filter(([, v]) => v && v.length)
    .map(([k]) => k);
  if (names.length === 0) return "Fix the highlighted fields below.";
  return `Fix the ${names.join(", ")} field${names.length === 1 ? "" : "s"} below.`;
}

export async function createMesocycle(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = mesocycleSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const m = parsed.data;

  // Cross-field check: if a deload week was specified, it must fit within
  // the planned length. Zod can't do this without a custom refine on the
  // whole object (kept simple at the schema level).
  if (
    m.deload_week_number != null &&
    m.deload_week_number > m.planned_weeks
  ) {
    return {
      ok: false,
      banner: "Deload week can't be past the end of the block.",
      errors: { deload_week_number: ["Past the end of the block"] },
      values,
    };
  }

  // The DB's partial unique index will reject a second active meso. Surface
  // a friendlier message than the raw 23505.
  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("mesocycles")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      name: m.name,
      started_at: m.started_at.toISOString().slice(0, 10),
      planned_weeks: m.planned_weeks,
      deload_week_number: m.deload_week_number ?? null,
      notes: m.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    const msg =
      error?.code === "23505"
        ? "You already have an active mesocycle. Close it first or edit the existing one."
        : (error?.message ?? "Failed to save mesocycle.");
    return { ok: false, banner: msg, values };
  }

  revalidatePath("/lifting/mesocycles");
  revalidatePath("/lifting");
  redirect(`/lifting/mesocycles/${row.id}?flash=created`);
}

export async function updateMesocycle(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = mesocycleSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const m = parsed.data;

  if (
    m.deload_week_number != null &&
    m.deload_week_number > m.planned_weeks
  ) {
    return {
      ok: false,
      banner: "Deload week can't be past the end of the block.",
      errors: { deload_week_number: ["Past the end of the block"] },
      values,
    };
  }

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("mesocycles")
    .update({
      name: m.name,
      started_at: m.started_at.toISOString().slice(0, 10),
      planned_weeks: m.planned_weeks,
      deload_week_number: m.deload_week_number ?? null,
      notes: m.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message, values };

  revalidatePath("/lifting/mesocycles");
  revalidatePath(`/lifting/mesocycles/${id}`);
  redirect(`/lifting/mesocycles/${id}?flash=updated`);
}

// Mark a meso complete. Sets ended_at = today and releases the "active"
// slot so a new meso can begin.
export async function finishMesocycle(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  await ctx.supabase
    .schema("wellness")
    .from("mesocycles")
    .update({ ended_at: today })
    .eq("id", id);

  revalidatePath("/lifting/mesocycles");
  revalidatePath(`/lifting/mesocycles/${id}`);
  revalidatePath("/lifting");
  redirect(`/lifting/mesocycles/${id}?flash=finished`);
}

// Reopen a closed meso. Useful if the user accidentally finished it OR
// wants to extend a block they prematurely closed. Will fail if another
// meso is currently active (DB-enforced).
export async function reopenMesocycle(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("mesocycles")
    .update({ ended_at: null })
    .eq("id", id);
  if (error && error.code === "23505") {
    redirect(`/lifting/mesocycles/${id}?flash=another_active`);
  }

  revalidatePath("/lifting/mesocycles");
  revalidatePath(`/lifting/mesocycles/${id}`);
  revalidatePath("/lifting");
  redirect(`/lifting/mesocycles/${id}?flash=reopened`);
}

export async function deleteMesocycle(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // workouts.mesocycle_id is ON DELETE SET NULL so past sessions are preserved.
  await ctx.supabase
    .schema("wellness")
    .from("mesocycles")
    .delete()
    .eq("id", id);

  revalidatePath("/lifting/mesocycles");
  revalidatePath("/lifting");
  redirect("/lifting/mesocycles?flash=deleted");
}
