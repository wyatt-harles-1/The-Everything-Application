"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { sleepSchema } from "@/lib/validation/wellness";
import {
  recordEvent,
  updateEventForDetail,
  deleteEventForDetail,
} from "@/lib/db/events";
import { getUserContext, type FormActionState } from "@/lib/db/session";

function durationMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function buildSleepSummary(s: {
  start_at: Date;
  end_at: Date;
  quality?: number | null;
}): string {
  const mins = durationMinutes(s.start_at, s.end_at);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const dur = m === 0 ? `${h}h` : `${h}h ${m}m`;
  return s.quality != null ? `${dur} · quality ${s.quality}` : dur;
}

export async function createSleep(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = sleepSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const s = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("sleep_sessions")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      start_at: s.start_at.toISOString(),
      end_at: s.end_at.toISOString(),
      quality: s.quality ?? null,
      interruptions: s.interruptions ?? null,
      dreams_notes: s.dreams_notes ?? null,
      notes: s.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, banner: error?.message ?? "Save failed." };

  const mins = durationMinutes(s.start_at, s.end_at);
  const { error: evtErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "sleep",
    occurredAt: s.start_at.toISOString(),
    durationMinutes: mins,
    detailTable: "wellness.sleep_sessions",
    detailId: row.id,
    title: "Sleep",
    summary: buildSleepSummary(s),
  });
  if (evtErr) {
    return {
      ok: false,
      banner: `Sleep saved but event sync failed: ${evtErr.message}`,
    };
  }

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/sleep/${row.id}?flash=created`);
}

export async function updateSleep(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = sleepSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const s = parsed.data;

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("sleep_sessions")
    .update({
      start_at: s.start_at.toISOString(),
      end_at: s.end_at.toISOString(),
      quality: s.quality ?? null,
      interruptions: s.interruptions ?? null,
      dreams_notes: s.dreams_notes ?? null,
      notes: s.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message };

  await updateEventForDetail(ctx.supabase, {
    detailTable: "wellness.sleep_sessions",
    detailId: id,
    occurredAt: s.start_at.toISOString(),
    durationMinutes: durationMinutes(s.start_at, s.end_at),
    summary: buildSleepSummary(s),
  });

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/sleep/${id}?flash=updated`);
}

export async function deleteSleep(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await deleteEventForDetail(ctx.supabase, {
    detailTable: "wellness.sleep_sessions",
    detailId: id,
  });
  await ctx.supabase
    .schema("wellness")
    .from("sleep_sessions")
    .delete()
    .eq("id", id);
  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log?flash=deleted");
}
