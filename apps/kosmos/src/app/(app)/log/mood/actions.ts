"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { moodSchema } from "@/lib/validation/wellness";
import {
  recordEvent,
  updateEventForDetail,
  deleteEventForDetail,
} from "@/lib/db/events";
import { getUserContext, type FormActionState } from "@/lib/db/session";

function buildMoodSummary(m: {
  mood: number;
  energy?: number | null;
  stress?: number | null;
  anxiety?: number | null;
  tags?: string[];
}): string {
  const parts: string[] = [`mood ${m.mood}`];
  if (m.energy != null) parts.push(`energy ${m.energy}`);
  if (m.stress != null) parts.push(`stress ${m.stress}`);
  if (m.anxiety != null) parts.push(`anxiety ${m.anxiety}`);
  if (m.tags?.length) parts.push(`${m.tags.length} tag${m.tags.length === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export async function createMood(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = moodSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const m = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("mood_entries")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      occurred_at: m.occurred_at.toISOString(),
      mood: m.mood,
      energy: m.energy ?? null,
      stress: m.stress ?? null,
      anxiety: m.anxiety ?? null,
      notes: m.notes ?? null,
      tags: m.tags ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, banner: error?.message ?? "Save failed." };

  const { error: evtErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "mood_check",
    occurredAt: m.occurred_at.toISOString(),
    detailTable: "wellness.mood_entries",
    detailId: row.id,
    title: `Mood ${m.mood}/10`,
    summary: buildMoodSummary(m),
  });
  if (evtErr) {
    return {
      ok: false,
      banner: `Mood saved but event sync failed: ${evtErr.message}`,
    };
  }

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/mood/${row.id}?flash=created`);
}

export async function updateMood(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = moodSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const m = parsed.data;

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("mood_entries")
    .update({
      occurred_at: m.occurred_at.toISOString(),
      mood: m.mood,
      energy: m.energy ?? null,
      stress: m.stress ?? null,
      anxiety: m.anxiety ?? null,
      notes: m.notes ?? null,
      tags: m.tags ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message };

  await updateEventForDetail(ctx.supabase, {
    detailTable: "wellness.mood_entries",
    detailId: id,
    occurredAt: m.occurred_at.toISOString(),
    title: `Mood ${m.mood}/10`,
    summary: buildMoodSummary(m),
  });

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/mood/${id}?flash=updated`);
}

export async function deleteMood(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await deleteEventForDetail(ctx.supabase, {
    detailTable: "wellness.mood_entries",
    detailId: id,
  });
  await ctx.supabase
    .schema("wellness")
    .from("mood_entries")
    .delete()
    .eq("id", id);
  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log?flash=deleted");
}
