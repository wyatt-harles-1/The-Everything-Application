"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { cycleEntrySchema } from "@/lib/validation/wellness";
import {
  recordEvent,
  updateEventForDetail,
  deleteEventForDetail,
} from "@/lib/db/events";
import { getUserContext, type FormActionState } from "@/lib/db/session";

function buildCycleSummary(c: {
  phase?: string | null;
  flow?: string | null;
  symptoms?: string[] | null;
}): string {
  const parts: string[] = [];
  if (c.phase) parts.push(c.phase);
  if (c.flow) parts.push(`flow: ${c.flow}`);
  if (c.symptoms?.length) {
    parts.push(`${c.symptoms.length} symptom${c.symptoms.length === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

// occurred_at is a DATE column. ISO timestamp shouldn't be used; we pass the
// YYYY-MM-DD string straight through.
function toDateOnlyString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export async function createCycle(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = cycleEntrySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const c = parsed.data;
  const dateStr = toDateOnlyString(c.occurred_at);

  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("cycle_entries")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      occurred_at: dateStr,
      phase: c.phase ?? null,
      flow: c.flow ?? null,
      symptoms: c.symptoms ?? null,
      notes: c.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, banner: error?.message ?? "Save failed." };

  // shared.events.occurred_at is timestamptz - turn the date into a noon
  // timestamp so the timeline sorts cleanly without timezone surprises.
  const eventTs = new Date(`${dateStr}T12:00:00Z`).toISOString();
  const { error: evtErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "cycle_entry",
    occurredAt: eventTs,
    detailTable: "wellness.cycle_entries",
    detailId: row.id,
    title: c.phase ? c.phase.charAt(0).toUpperCase() + c.phase.slice(1) : "Cycle entry",
    summary: buildCycleSummary(c) || null,
  });
  if (evtErr) {
    return {
      ok: false,
      banner: `Cycle entry saved but event sync failed: ${evtErr.message}`,
    };
  }

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/cycle/${row.id}?flash=created`);
}

export async function updateCycle(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = cycleEntrySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const c = parsed.data;
  const dateStr = toDateOnlyString(c.occurred_at);

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("cycle_entries")
    .update({
      occurred_at: dateStr,
      phase: c.phase ?? null,
      flow: c.flow ?? null,
      symptoms: c.symptoms ?? null,
      notes: c.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message };

  const eventTs = new Date(`${dateStr}T12:00:00Z`).toISOString();
  await updateEventForDetail(ctx.supabase, {
    detailTable: "wellness.cycle_entries",
    detailId: id,
    occurredAt: eventTs,
    title: c.phase ? c.phase.charAt(0).toUpperCase() + c.phase.slice(1) : "Cycle entry",
    summary: buildCycleSummary(c) || null,
  });

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/cycle/${id}?flash=updated`);
}

export async function deleteCycle(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await deleteEventForDetail(ctx.supabase, {
    detailTable: "wellness.cycle_entries",
    detailId: id,
  });
  await ctx.supabase
    .schema("wellness")
    .from("cycle_entries")
    .delete()
    .eq("id", id);
  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log?flash=deleted");
}
