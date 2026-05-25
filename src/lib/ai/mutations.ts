// Server-side mutation handlers invoked by the /api/assistant/run-tool
// dispatcher. Each takes typed input (validated upstream against the
// schemas in ./mutationSchemas) and returns a small, serializable
// result the chat thread feeds back to the LLM.
//
// All writes go through the same RLS-protected supabase client the UI
// uses, so the agent cannot mutate another user's row.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordEvent } from "@/lib/db/events";

import type {
  CreateGoalInput,
  CreateHabitInput,
  MarkEventDoneInput,
  MarkEventSkippedInput,
  ScheduleEventInput,
  UpdateGoalStatusInput,
} from "./mutationSchemas";

type Ctx = { userId: string; sourceId: string; supabase: SupabaseClient };

export async function agentScheduleEvent(
  ctx: Ctx,
  input: ScheduleEventInput,
): Promise<{ ok: true; id: string; scheduled_for: string } | { ok: false; error: string }> {
  const when = new Date(input.scheduled_for);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: "scheduled_for is not a valid datetime" };
  }
  const { data, error } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      domain: input.domain,
      event_type: input.event_type,
      scheduled_for: when.toISOString(),
      title: input.title,
      notes: input.notes ?? null,
    })
    .select("id, scheduled_for")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }
  return { ok: true, id: data.id, scheduled_for: data.scheduled_for };
}

export async function agentMarkEventDone(
  ctx: Ctx,
  input: MarkEventDoneInput,
): Promise<
  | { ok: true; event_id: string | null }
  | { ok: false; error: string }
> {
  const { data: row } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .select(
      "id, domain, event_type, title, notes, detail_table, detail_id",
    )
    .eq("id", input.scheduled_event_id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Scheduled event not found" };

  const now = new Date().toISOString();
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
    return { ok: false, error: `Event sync failed: ${evtErr.message}` };
  }
  const { error: updErr } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .update({
      status: "done",
      completed_at: now,
      completed_event_id: eventId,
    })
    .eq("id", input.scheduled_event_id);
  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true, event_id: eventId };
}

export async function agentMarkEventSkipped(
  ctx: Ctx,
  input: MarkEventSkippedInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await ctx.supabase
    .schema("shared")
    .from("scheduled_events")
    .update({ status: "skipped" })
    .eq("id", input.scheduled_event_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function agentCreateHabit(
  ctx: Ctx,
  input: CreateHabitInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const startedAt =
    input.started_at && input.started_at.trim() !== ""
      ? input.started_at
      : new Date().toISOString().slice(0, 10);
  const { data, error } = await ctx.supabase
    .schema("shared")
    .from("habits")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      name: input.name,
      domain: input.domain,
      event_type: input.event_type ?? null,
      target_frequency_per_week: input.target_frequency_per_week,
      started_at: startedAt,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, id: data.id };
}

export async function agentCreateGoal(
  ctx: Ctx,
  input: CreateGoalInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await ctx.supabase
    .schema("shared")
    .from("goals")
    .insert({
      user_id: ctx.userId,
      title: input.title,
      description: input.description ?? null,
      domain: input.domain,
      category: input.category ?? null,
      target_metric: input.target_metric ?? null,
      target_value: input.target_value ?? null,
      target_date: input.target_date ?? null,
      priority: input.priority ?? 3,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, id: data.id };
}

export async function agentUpdateGoalStatus(
  ctx: Ctx,
  input: UpdateGoalStatusInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await ctx.supabase
    .schema("shared")
    .from("goals")
    .update({ status: input.status })
    .eq("id", input.goal_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
