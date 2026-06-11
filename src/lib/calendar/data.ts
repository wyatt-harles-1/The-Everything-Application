// Server-side calendar data: planned scheduled-events + active-goal deadlines in
// a date range, flattened into CalendarItems. Recurring series are already
// materialized into real instance rows (recurrence_rule IS NULL on instances +
// one-offs), so this is a flat range SELECT — no virtual expansion needed.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dayKey } from "@/lib/analytics/buckets";
import type { CalendarItem } from "./types";

export async function fetchCalendarItems(
  supabase: SupabaseClient,
  fromISO: string,
  toISO: string,
): Promise<CalendarItem[]> {
  const [evRes, goalRes] = await Promise.all([
    supabase
      .schema("shared")
      .from("scheduled_events")
      .select("id, title, domain, scheduled_for, status")
      .is("recurrence_rule", null)
      .gte("scheduled_for", fromISO)
      .lt("scheduled_for", toISO)
      .order("scheduled_for", { ascending: true }),
    supabase
      .schema("shared")
      .from("goals")
      .select("id, title, domain, target_date, status")
      .eq("status", "active")
      .not("target_date", "is", null)
      .gte("target_date", fromISO.slice(0, 10))
      .lte("target_date", toISO.slice(0, 10)),
  ]);

  const items: CalendarItem[] = [];
  for (const e of evRes.data ?? []) {
    items.push({
      id: e.id,
      kind: "event",
      title: e.title,
      dateKey: dayKey(new Date(e.scheduled_for)),
      domain: e.domain,
      status: e.status,
      href: `/schedule/${e.id}`,
    });
  }
  for (const g of goalRes.data ?? []) {
    items.push({
      id: g.id,
      kind: "goal",
      title: g.title,
      dateKey: g.target_date as string,
      domain: g.domain,
      status: null,
      href: `/goals/${g.id}`,
    });
  }
  return items;
}
