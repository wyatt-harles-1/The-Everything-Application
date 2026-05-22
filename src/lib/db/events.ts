// Thin wrappers around the shared.record_event / update_event_for_detail /
// delete_event_for_detail Postgres functions. Wave 1 Server Actions call
// these right after a successful insert / update / delete on a wellness
// detail table so the timeline always reflects the source-of-truth tables.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordEventArgs = {
  userId: string;
  sourceId: string;
  domain: string;
  eventType: string;
  occurredAt: string;             // ISO8601 string
  detailTable: string;
  detailId: string;
  durationMinutes?: number | null;
  title?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordEvent(
  supabase: SupabaseClient,
  args: RecordEventArgs,
) {
  const { error } = await supabase.schema("shared").rpc("record_event", {
    p_user_id: args.userId,
    p_source_id: args.sourceId,
    p_domain: args.domain,
    p_event_type: args.eventType,
    p_occurred_at: args.occurredAt,
    p_detail_table: args.detailTable,
    p_detail_id: args.detailId,
    p_duration_minutes: args.durationMinutes ?? null,
    p_title: args.title ?? null,
    p_summary: args.summary ?? null,
    p_metadata: args.metadata ?? {},
  });
  return { error };
}

export async function updateEventForDetail(
  supabase: SupabaseClient,
  args: {
    detailTable: string;
    detailId: string;
    occurredAt?: string | null;
    durationMinutes?: number | null;
    title?: string | null;
    summary?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const { error } = await supabase
    .schema("shared")
    .rpc("update_event_for_detail", {
      p_detail_table: args.detailTable,
      p_detail_id: args.detailId,
      p_occurred_at: args.occurredAt ?? null,
      p_duration_minutes: args.durationMinutes ?? null,
      p_title: args.title ?? null,
      p_summary: args.summary ?? null,
      p_metadata: args.metadata ?? null,
    });
  return { error };
}

export async function deleteEventForDetail(
  supabase: SupabaseClient,
  args: { detailTable: string; detailId: string },
) {
  const { error } = await supabase
    .schema("shared")
    .rpc("delete_event_for_detail", {
      p_detail_table: args.detailTable,
      p_detail_id: args.detailId,
    });
  return { error };
}
