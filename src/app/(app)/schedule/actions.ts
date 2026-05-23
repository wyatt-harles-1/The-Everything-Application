// Server Actions for /schedule. Written tool-shaped per invariant #7: each
// action takes typed inputs and returns a typed result, no form-binding
// assumptions baked into the action body. The form actions
// (createScheduledEvent, updateScheduledEvent) follow the FormActionState
// pattern used elsewhere; the lifecycle actions (mark done / skip /
// delete) are direct calls.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { scheduledEventSchema } from "@/lib/validation/scheduler";
import { recordEvent } from "@/lib/db/events";
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

export async function createScheduledEvent(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = scheduledEventSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const e = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      domain: e.domain,
      event_type: e.event_type,
      scheduled_for: e.scheduled_for.toISOString(),
      title: e.title,
      notes: e.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, banner: error?.message ?? "Failed to save.", values };
  }

  revalidatePath("/schedule");
  revalidatePath("/");
  redirect(`/schedule/${row.id}?flash=created`);
}

export async function updateScheduledEvent(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = scheduledEventSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const e = parsed.data;

  const { error } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .update({
      domain: e.domain,
      event_type: e.event_type,
      scheduled_for: e.scheduled_for.toISOString(),
      title: e.title,
      notes: e.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message, values };

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  revalidatePath("/");
  redirect(`/schedule/${id}?flash=updated`);
}

// "Mark done" — flip status, emit a shared.events row so the timeline +
// analytics see the realized activity, and stash the event id on the
// scheduled row so the link is bidirectional.
export async function markScheduledEventDone(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  const { data: row } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .select("id, domain, event_type, title, notes, detail_table, detail_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) redirect("/schedule?flash=not_found");

  const now = new Date().toISOString();

  // Emit the realized event. If the planned event was linked to a domain
  // detail row (e.g., a lifting session), carry that through. Otherwise
  // the scheduled_event itself acts as the "detail" so the timeline
  // invariant - every event traces back to a detail row - still holds.
  const { eventId, error: evtErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: row.domain,
    eventType: row.event_type,
    occurredAt: now,
    detailTable: row.detail_table ?? "shared.scheduled_events",
    detailId: row.detail_id ?? row.id,
    title: row.title,
    summary: row.notes ?? null,
  });
  if (evtErr) {
    redirect(`/schedule/${id}?flash=event_sync_failed`);
  }

  await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .update({
      status: "done",
      completed_at: now,
      completed_event_id: eventId,
    })
    .eq("id", id);

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  revalidatePath("/");
  redirect(`/schedule/${id}?flash=done`);
}

export async function markScheduledEventSkipped(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .update({ status: "skipped" })
    .eq("id", id);

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  redirect(`/schedule/${id}?flash=skipped`);
}

// Re-open a previously-done/skipped event. Doesn't undo the realized
// shared.events row (it's already part of history) - that lives on its own.
export async function reopenScheduledEvent(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .update({
      status: "planned",
      completed_at: null,
      completed_event_id: null,
    })
    .eq("id", id);

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  redirect(`/schedule/${id}?flash=reopened`);
}

export async function deleteScheduledEvent(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .delete()
    .eq("id", id);

  revalidatePath("/schedule");
  revalidatePath("/");
  redirect("/schedule?flash=deleted");
}
