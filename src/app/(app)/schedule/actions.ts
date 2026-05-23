// Server Actions for /schedule. Written tool-shaped per invariant #7: each
// action takes typed inputs and returns a typed result, no form-binding
// assumptions baked into the action body. The form actions
// (createScheduledEvent, updateScheduledEvent) follow the FormActionState
// pattern used elsewhere; the lifecycle actions (mark done / skip /
// delete) are direct calls.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  scheduledEventSchema,
  type RecurrenceRuleInput,
} from "@/lib/validation/scheduler";
import { recordEvent } from "@/lib/db/events";
import {
  generateInstanceDates,
  DEFAULT_HORIZON_DAYS,
  type RecurrenceRule,
} from "@/lib/scheduler/recurrence";
import {
  getUserContext,
  captureValues,
  type FormActionState,
} from "@/lib/db/session";
import type { SupabaseClient } from "@supabase/supabase-js";

function bannerFor(fieldErrors: Record<string, string[] | undefined>): string {
  const names = Object.entries(fieldErrors)
    .filter(([, v]) => v && v.length)
    .map(([k]) => k);
  if (names.length === 0) return "Fix the highlighted fields below.";
  return `Fix the ${names.join(", ")} field${names.length === 1 ? "" : "s"} below.`;
}

// Extract the recurrence rule (if any) from FormData. The form sends a
// flat "repeats" checkbox plus freq/days/until fields; we reshape into
// the JSON object that schema + DB column expect.
function extractRecurrence(fd: FormData): RecurrenceRuleInput | undefined {
  const repeats = fd.get("repeats");
  if (repeats !== "on" && repeats !== "true") return undefined;
  const freq = fd.get("recurrence_freq") as string | null;
  if (!freq) return undefined;
  const days = fd
    .getAll("recurrence_days")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
  const until = (fd.get("recurrence_until") as string | null) ?? undefined;
  return {
    freq: freq as RecurrenceRuleInput["freq"],
    days: freq === "weekly" && days.length > 0 ? days : undefined,
    until: until && until.trim() !== "" ? until : undefined,
  };
}

// Materialize concrete instance rows for a series template. Called at
// template-create time and on user-triggered re-materialize. Skips dates
// where an instance (planned or done) already exists so it's safe to call
// repeatedly.
async function materializeSeriesInstances(
  supabase: SupabaseClient,
  ctx: { userId: string; sourceId: string },
  template: {
    id: string;
    scheduled_for: string;
    title: string;
    domain: string;
    event_type: string;
    notes: string | null;
    recurrence_rule: RecurrenceRule;
  },
  horizonDays: number = DEFAULT_HORIZON_DAYS,
): Promise<void> {
  const seriesStart = new Date(template.scheduled_for);
  const from = new Date(Math.max(seriesStart.getTime(), Date.now()));
  const to = new Date(from);
  to.setDate(to.getDate() + horizonDays);

  const dates: Date[] = [];
  for (const d of generateInstanceDates(
    template.recurrence_rule,
    seriesStart,
    from,
    to,
  )) {
    dates.push(d);
  }
  if (dates.length === 0) return;

  // Look up which dates already have an instance so we can skip
  // re-inserting them. Idempotent re-materialize.
  const { data: existing } = await supabase
    .schema("shared")
    .from("scheduled_events")
    .select("scheduled_for")
    .eq("parent_scheduled_id", template.id);
  const haveTimestamps = new Set(
    (existing ?? []).map((r) => new Date(r.scheduled_for).getTime()),
  );

  const toInsert = dates
    .filter((d) => !haveTimestamps.has(d.getTime()))
    .map((d) => ({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      parent_scheduled_id: template.id,
      domain: template.domain,
      event_type: template.event_type,
      scheduled_for: d.toISOString(),
      title: template.title,
      notes: template.notes,
    }));
  if (toInsert.length === 0) return;

  await supabase.schema("shared").from("scheduled_events").insert(toInsert);
}

export async function createScheduledEvent(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const recurrence = extractRecurrence(fd);
  const parsed = scheduledEventSchema.safeParse({
    ...Object.fromEntries(fd),
    recurrence_rule: recurrence,
  });
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
      recurrence_rule: e.recurrence_rule ?? null,
    })
    .select("id, scheduled_for, title, domain, event_type, notes, recurrence_rule")
    .single();
  if (error || !row) {
    return { ok: false, banner: error?.message ?? "Failed to save.", values };
  }

  // If a recurrence rule was provided, materialize concrete instance rows
  // for the next 90 days so the agenda view shows them immediately.
  if (e.recurrence_rule) {
    await materializeSeriesInstances(ctx.supabase, ctx, {
      id: row.id,
      scheduled_for: row.scheduled_for,
      title: row.title,
      domain: row.domain,
      event_type: row.event_type,
      notes: row.notes,
      recurrence_rule: e.recurrence_rule as RecurrenceRule,
    });
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

  const recurrence = extractRecurrence(fd);
  const parsed = scheduledEventSchema.safeParse({
    ...Object.fromEntries(fd),
    recurrence_rule: recurrence,
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const e = parsed.data;

  // Edit semantics: we update this row's fields. We do NOT auto-re-
  // materialize future instances when a template's rule changes - the
  // user does that explicitly via the "Re-materialize series" button so
  // they're never surprised by a silent rewrite of their calendar.
  const { error } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .update({
      domain: e.domain,
      event_type: e.event_type,
      scheduled_for: e.scheduled_for.toISOString(),
      title: e.title,
      notes: e.notes ?? null,
      recurrence_rule: e.recurrence_rule ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message, values };

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  revalidatePath("/");
  redirect(`/schedule/${id}?flash=updated`);
}

// Wipe future planned instances of a series template and regenerate
// them from the template's current recurrence_rule. Completed/skipped/
// missed past instances are preserved. Idempotent - safe to call twice.
export async function rematerializeSeries(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // Load the template.
  const { data: template } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .select(
      "id, scheduled_for, title, domain, event_type, notes, recurrence_rule",
    )
    .eq("id", id)
    .maybeSingle();
  if (!template || !template.recurrence_rule) {
    redirect(`/schedule/${id}?flash=not_a_series`);
  }

  // Delete future PLANNED instances. Past + completed/skipped instances
  // stay - they're history.
  const nowIso = new Date().toISOString();
  await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .delete()
    .eq("parent_scheduled_id", id)
    .eq("status", "planned")
    .gt("scheduled_for", nowIso);

  await materializeSeriesInstances(ctx.supabase, ctx, {
    id: template.id,
    scheduled_for: template.scheduled_for,
    title: template.title,
    domain: template.domain,
    event_type: template.event_type,
    notes: template.notes,
    recurrence_rule: template.recurrence_rule as RecurrenceRule,
  });

  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  redirect(`/schedule/${id}?flash=rematerialized`);
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

// Accept a suggestion: insert a new scheduled_events row from suggestion
// fields. Tool-shaped (invariant #7) - same surface the Phase 4e master
// agent will call to "schedule the lift you suggested for Friday."
export async function acceptSuggestion(input: {
  scheduled_for: string;
  domain: string;
  event_type: string;
  title: string;
  notes?: string | null;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, error: "Not signed in" };

  const { data, error } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      domain: input.domain,
      event_type: input.event_type,
      scheduled_for: input.scheduled_for,
      title: input.title,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  revalidatePath("/schedule");
  revalidatePath("/");
  return { ok: true, id: data.id };
}

export async function deleteScheduledEvent(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // If this is a series template, orphan its instances first so past
  // completed history is preserved. The FK is ON DELETE CASCADE - without
  // this UPDATE, deleting the template would wipe done/skipped instances
  // too, losing history.
  await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .update({ parent_scheduled_id: null })
    .eq("parent_scheduled_id", id);

  await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .delete()
    .eq("id", id);

  revalidatePath("/schedule");
  revalidatePath("/");
  redirect("/schedule?flash=deleted");
}
