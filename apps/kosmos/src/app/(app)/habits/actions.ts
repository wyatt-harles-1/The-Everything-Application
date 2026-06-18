// Server Actions for /habits. CRUD + soft-archive/unarchive. Following
// invariant #7 (tool-shaped): each action takes typed inputs and returns
// a typed FormActionState (or void for the lifecycle actions).

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { habitSchema } from "@/lib/validation/habits";
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

export async function createHabit(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = habitSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const h = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("shared")
    .from("habits")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      name: h.name,
      domain: h.domain,
      event_type: h.event_type ?? null,
      target_frequency_per_week: h.target_frequency_per_week,
      started_at: h.started_at.toISOString().slice(0, 10),
      notes: h.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, banner: error?.message ?? "Failed to save.", values };
  }

  revalidatePath("/habits");
  revalidatePath("/schedule");
  redirect(`/habits/${row.id}?flash=created`);
}

export async function updateHabit(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = habitSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const h = parsed.data;

  const { error } = await ctx.supabase
    .schema("shared")
    .from("habits")
    .update({
      name: h.name,
      domain: h.domain,
      event_type: h.event_type ?? null,
      target_frequency_per_week: h.target_frequency_per_week,
      started_at: h.started_at.toISOString().slice(0, 10),
      notes: h.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message, values };

  revalidatePath("/habits");
  revalidatePath(`/habits/${id}`);
  revalidatePath("/schedule");
  redirect(`/habits/${id}?flash=updated`);
}

export async function archiveHabit(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("shared")
    .from("habits")
    .update({ active: false })
    .eq("id", id);
  revalidatePath("/habits");
  revalidatePath(`/habits/${id}`);
  revalidatePath("/schedule");
  redirect(`/habits/${id}?flash=archived`);
}

export async function unarchiveHabit(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("shared")
    .from("habits")
    .update({ active: true })
    .eq("id", id);
  revalidatePath("/habits");
  revalidatePath(`/habits/${id}`);
  revalidatePath("/schedule");
  redirect(`/habits/${id}?flash=unarchived`);
}

export async function deleteHabit(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase.schema("shared").from("habits").delete().eq("id", id);
  revalidatePath("/habits");
  revalidatePath("/schedule");
  redirect("/habits?flash=deleted");
}
