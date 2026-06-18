// Server Actions for wellness.meals: create / update / delete.
// Each action validates with the Zod schema, writes the meal, calls the
// shared.record_event helper to keep the timeline in sync, then redirects.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { mealSchema } from "@/lib/validation/wellness";
import {
  recordEvent,
  updateEventForDetail,
  deleteEventForDetail,
} from "@/lib/db/events";
import { getUserContext, type FormActionState } from "@/lib/db/session";

// Built-in summary string the timeline shows. Skipping COALESCE-equivalent
// for empty fields so we don't render "dinner -  -  cal -  -  protein".
function buildMealSummary(meal: {
  meal_type?: string | null;
  calories?: number | null;
  protein_g?: number | null;
}): string {
  const parts: string[] = [];
  if (meal.meal_type) {
    parts.push(meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1));
  }
  if (meal.calories != null) parts.push(`${meal.calories} cal`);
  if (meal.protein_g != null) parts.push(`${meal.protein_g}g protein`);
  return parts.join(" · ");
}

export async function createMeal(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = mealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const m = parsed.data;

  const { data: meal, error: insertErr } = await ctx.supabase
    .schema("wellness")
    .from("meals")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      occurred_at: m.occurred_at.toISOString(),
      meal_type: m.meal_type ?? null,
      description: m.description,
      calories: m.calories ?? null,
      protein_g: m.protein_g ?? null,
      carbs_g: m.carbs_g ?? null,
      fat_g: m.fat_g ?? null,
      fiber_g: m.fiber_g ?? null,
      notes: m.notes ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !meal) {
    return { ok: false, banner: insertErr?.message ?? "Failed to save meal." };
  }

  // Best-effort: record an event row. If this errors, the meal still exists -
  // we surface a banner but don't redirect away. The meal can be re-saved /
  // re-eventified later.
  const summary = buildMealSummary(m);
  const { error: eventErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "meal",
    occurredAt: m.occurred_at.toISOString(),
    detailTable: "wellness.meals",
    detailId: meal.id,
    title: m.description,
    summary: summary || null,
  });
  if (eventErr) {
    return {
      ok: false,
      banner: `Meal saved but event sync failed: ${eventErr.message}`,
    };
  }

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/meal/${meal.id}?flash=created`);
}

export async function updateMeal(
  mealId: string,
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = mealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const m = parsed.data;

  const { error: updateErr } = await ctx.supabase
    .schema("wellness")
    .from("meals")
    .update({
      occurred_at: m.occurred_at.toISOString(),
      meal_type: m.meal_type ?? null,
      description: m.description,
      calories: m.calories ?? null,
      protein_g: m.protein_g ?? null,
      carbs_g: m.carbs_g ?? null,
      fat_g: m.fat_g ?? null,
      fiber_g: m.fiber_g ?? null,
      notes: m.notes ?? null,
    })
    .eq("id", mealId);

  if (updateErr) {
    return { ok: false, banner: updateErr.message };
  }

  await updateEventForDetail(ctx.supabase, {
    detailTable: "wellness.meals",
    detailId: mealId,
    occurredAt: m.occurred_at.toISOString(),
    title: m.description,
    summary: buildMealSummary(m) || null,
  });

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/meal/${mealId}?flash=updated`);
}

export async function deleteMeal(mealId: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // Order: delete the event first so a partial failure leaves a meal
  // without an event (recoverable - we can re-emit) rather than an event
  // without a meal (a dangling timeline entry that needs manual cleanup).
  await deleteEventForDetail(ctx.supabase, {
    detailTable: "wellness.meals",
    detailId: mealId,
  });
  await ctx.supabase
    .schema("wellness")
    .from("meals")
    .delete()
    .eq("id", mealId);

  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log?flash=deleted");
}
