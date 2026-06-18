// Server Actions for /goals. CRUD + lifecycle (achieve / pause / resume /
// abandon / delete). All tool-shaped per invariant #7 - the master agent
// (Phase 4e) will call these same actions to record + mutate goals on
// the user's behalf.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { goalSchema } from "@/lib/validation/goals";
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

export async function createGoal(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = goalSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const g = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("shared")
    .from("goals")
    .insert({
      user_id: ctx.userId,
      title: g.title,
      description: g.description ?? null,
      domain: g.domain,
      category: g.category ?? null,
      target_metric: g.target_metric ?? null,
      target_value: g.target_value ?? null,
      target_date: g.target_date
        ? g.target_date.toISOString().slice(0, 10)
        : null,
      priority: g.priority,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, banner: error?.message ?? "Failed to save.", values };
  }

  revalidatePath("/goals");
  revalidatePath("/");
  redirect(`/goals/${row.id}?flash=created`);
}

export async function updateGoal(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = goalSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const g = parsed.data;

  const { error } = await ctx.supabase
    .schema("shared")
    .from("goals")
    .update({
      title: g.title,
      description: g.description ?? null,
      domain: g.domain,
      category: g.category ?? null,
      target_metric: g.target_metric ?? null,
      target_value: g.target_value ?? null,
      target_date: g.target_date
        ? g.target_date.toISOString().slice(0, 10)
        : null,
      priority: g.priority,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message, values };

  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
  revalidatePath("/");
  redirect(`/goals/${id}?flash=updated`);
}

// Lifecycle actions. All flip status; UI surfaces them as separate
// buttons so the user's intent is unambiguous.

async function setGoalStatus(
  id: string,
  status: "active" | "paused" | "achieved" | "abandoned",
  flash: string,
): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("shared")
    .from("goals")
    .update({ status })
    .eq("id", id);
  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
  revalidatePath("/");
  redirect(`/goals/${id}?flash=${flash}`);
}

export async function achieveGoal(id: string): Promise<void> {
  return setGoalStatus(id, "achieved", "achieved");
}
export async function pauseGoal(id: string): Promise<void> {
  return setGoalStatus(id, "paused", "paused");
}
export async function resumeGoal(id: string): Promise<void> {
  return setGoalStatus(id, "active", "resumed");
}
export async function abandonGoal(id: string): Promise<void> {
  return setGoalStatus(id, "abandoned", "abandoned");
}

export async function deleteGoal(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase.schema("shared").from("goals").delete().eq("id", id);
  revalidatePath("/goals");
  revalidatePath("/");
  redirect("/goals?flash=deleted");
}
