"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { bodyCompositionSchema } from "@/lib/validation/wellness";
import {
  recordEvent,
  updateEventForDetail,
  deleteEventForDetail,
} from "@/lib/db/events";
import { getUserContext, type FormActionState } from "@/lib/db/session";

function buildBodySummary(b: {
  weight_lbs?: number | null;
  body_fat_pct?: number | null;
}): string {
  const parts: string[] = [];
  if (b.weight_lbs != null) parts.push(`${b.weight_lbs} lbs`);
  if (b.body_fat_pct != null) parts.push(`${b.body_fat_pct}% BF`);
  return parts.join(" · ");
}

export async function createBody(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = bodyCompositionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const b = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("body_composition")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      measured_at: b.measured_at.toISOString(),
      weight_lbs: b.weight_lbs ?? null,
      body_fat_pct: b.body_fat_pct ?? null,
      skeletal_muscle_lbs: b.skeletal_muscle_lbs ?? null,
      waist_in: b.waist_in ?? null,
      chest_in: b.chest_in ?? null,
      arm_in: b.arm_in ?? null,
      thigh_in: b.thigh_in ?? null,
      notes: b.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, banner: error?.message ?? "Save failed." };

  const summary = buildBodySummary(b);
  const { error: evtErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "body_measurement",
    occurredAt: b.measured_at.toISOString(),
    detailTable: "wellness.body_composition",
    detailId: row.id,
    title: "Body measurement",
    summary: summary || null,
  });
  if (evtErr) {
    return {
      ok: false,
      banner: `Body comp saved but event sync failed: ${evtErr.message}`,
    };
  }

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/body/${row.id}?flash=created`);
}

export async function updateBody(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = bodyCompositionSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const b = parsed.data;

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("body_composition")
    .update({
      measured_at: b.measured_at.toISOString(),
      weight_lbs: b.weight_lbs ?? null,
      body_fat_pct: b.body_fat_pct ?? null,
      skeletal_muscle_lbs: b.skeletal_muscle_lbs ?? null,
      waist_in: b.waist_in ?? null,
      chest_in: b.chest_in ?? null,
      arm_in: b.arm_in ?? null,
      thigh_in: b.thigh_in ?? null,
      notes: b.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message };

  await updateEventForDetail(ctx.supabase, {
    detailTable: "wellness.body_composition",
    detailId: id,
    occurredAt: b.measured_at.toISOString(),
    summary: buildBodySummary(b) || null,
  });

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/body/${id}?flash=updated`);
}

export async function deleteBody(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await deleteEventForDetail(ctx.supabase, {
    detailTable: "wellness.body_composition",
    detailId: id,
  });
  await ctx.supabase
    .schema("wellness")
    .from("body_composition")
    .delete()
    .eq("id", id);
  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log?flash=deleted");
}
