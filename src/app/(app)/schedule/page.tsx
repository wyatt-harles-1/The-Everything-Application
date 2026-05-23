// /schedule - day-grouped agenda of planned events plus a "Recurring
// schedules" section showing series templates. Day-grouped (one section
// per calendar day) replaces the earlier Today/Tomorrow/This-week/Later
// buckets - more useful once recurrence pre-fills weeks of events.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatTime, formatDate } from "@/lib/format";
import {
  describeRule,
  type RecurrenceRule,
} from "@/lib/scheduler/recurrence";
import {
  computeHabitProgress,
  startOfISOWeek,
} from "@/lib/scheduler/streak";
import {
  suggestLiftingForWeek,
  type LiftingRules,
  type ActiveMesoForSuggest,
} from "@/lib/lifting/suggest";

import { SuggestionsPanel, type Suggestion } from "./SuggestionsPanel";

type ScheduledRow = {
  id: string;
  domain: string;
  event_type: string;
  scheduled_for: string;
  title: string;
  notes: string | null;
  status: "planned" | "done" | "skipped" | "missed";
  parent_scheduled_id: string | null;
};

type TemplateRow = {
  id: string;
  domain: string;
  event_type: string;
  scheduled_for: string;
  title: string;
  recurrence_rule: RecurrenceRule;
};

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// Day label like "Today · Sat May 24" so the user can both pattern-match
// (Today / Tomorrow) and see the date.
function dayLabel(d: Date): string {
  const now = startOfDay(new Date());
  const day = startOfDay(d);
  const diffDays = Math.round(
    (day.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const prefix =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Tomorrow"
        : diffDays === -1
          ? "Yesterday"
          : null;
  const base = day.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return prefix ? `${prefix} · ${base}` : base;
}

function groupByDay(events: ScheduledRow[]): Map<number, ScheduledRow[]> {
  const map = new Map<number, ScheduledRow[]>();
  for (const e of events) {
    const key = startOfDay(new Date(e.scheduled_for)).getTime();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();

  // Agenda query: planned items that are NOT series templates. Includes
  // both one-offs and materialized recurrence instances - they look the
  // same to the user.
  const { data: rows } = await supabase
    .schema("shared")
    .from("scheduled_events")
    .select(
      "id, domain, event_type, scheduled_for, title, notes, status, parent_scheduled_id, recurrence_rule",
    )
    .eq("status", "planned")
    .is("recurrence_rule", null)
    .order("scheduled_for", { ascending: true });

  const events = (rows ?? []) as (ScheduledRow & {
    recurrence_rule: unknown;
  })[];
  const grouped = groupByDay(events);
  const sortedDays = Array.from(grouped.keys()).sort();

  // Recurring schedules: rows that ARE templates (have a recurrence_rule
  // and no parent). Surface them as their own short list so the user can
  // jump to manage the series.
  const { data: templateRows } = await supabase
    .schema("shared")
    .from("scheduled_events")
    .select(
      "id, domain, event_type, scheduled_for, title, recurrence_rule",
    )
    .not("recurrence_rule", "is", null)
    .is("parent_scheduled_id", null)
    .order("created_at", { ascending: false });
  const templates = (templateRows ?? []) as TemplateRow[];

  // Active habits panel: pull active habits + recent events, compute
  // progress per habit. 60 days is enough for streaks up to ~8 weeks.
  const { data: habitRows } = await supabase
    .schema("shared")
    .from("habits")
    .select(
      "id, name, domain, event_type, target_frequency_per_week, started_at",
    )
    .eq("active", true)
    .order("started_at", { ascending: false });
  const habits = (habitRows ?? []) as {
    id: string;
    name: string;
    domain: string;
    event_type: string | null;
    target_frequency_per_week: number;
    started_at: string;
  }[];

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const { data: habitEvents } = habits.length > 0
    ? await supabase
        .schema("shared")
        .from("events")
        .select("domain, event_type, occurred_at")
        .gte("occurred_at", sixtyDaysAgo.toISOString())
        .order("occurred_at", { ascending: true })
    : { data: [] };

  // ---- Suggestions: lifting (first module to participate) ---------------
  // Read the user's lifting_rules (if any) + active mesocycle, then for
  // this week + next week, propose sessions not already in the agenda.
  // The panel itself is a client component that calls acceptSuggestion()
  // per-row.
  const { data: rulesRow } = await supabase
    .schema("wellness")
    .from("lifting_rules")
    .select(
      "frequency_per_week, preferred_days, default_time, skip_deload",
    )
    .maybeSingle();
  const liftingRules = rulesRow as LiftingRules | null;

  const suggestions: Suggestion[] = [];
  if (liftingRules && liftingRules.frequency_per_week > 0) {
    // Active mesocycle for context (title prefix + deload skip).
    const { data: mesoRow } = await supabase
      .schema("wellness")
      .from("mesocycles")
      .select(
        "id, name, started_at, planned_weeks, deload_week_number, ended_at",
      )
      .is("ended_at", null)
      .maybeSingle();
    const meso = mesoRow as ActiveMesoForSuggest;

    // Existing planned workouts in the upcoming weeks (so we don't double-
    // suggest a slot the user already has).
    const horizonStart = startOfISOWeek(new Date());
    const horizonEnd = new Date(horizonStart);
    horizonEnd.setDate(horizonEnd.getDate() + 14);
    const { data: existing } = await supabase
      .schema("shared")
      .from("scheduled_events")
      .select("scheduled_for")
      .eq("status", "planned")
      .eq("domain", "wellness")
      .eq("event_type", "workout")
      .gte("scheduled_for", horizonStart.toISOString())
      .lt("scheduled_for", horizonEnd.toISOString());
    const existingDates = (existing ?? []).map((r) => new Date(r.scheduled_for));

    // This week + next week.
    for (const offsetWeeks of [0, 1]) {
      const wkStart = new Date(horizonStart);
      wkStart.setDate(wkStart.getDate() + offsetWeeks * 7);
      const wkEnd = new Date(wkStart);
      wkEnd.setDate(wkEnd.getDate() + 7);
      const inThisWeek = existingDates.filter(
        (d) => d >= wkStart && d < wkEnd,
      );
      const proposed = suggestLiftingForWeek({
        rules: liftingRules,
        meso,
        weekStart: wkStart,
        existingWorkoutTimes: inThisWeek,
      });
      for (const p of proposed) {
        const when = new Date(p.scheduled_for);
        // Skip past times in the current week (showing "lift Mon 5pm" on
        // Tuesday is just noise).
        if (when < new Date()) continue;
        suggestions.push({
          key: p.scheduled_for,
          scheduled_for: p.scheduled_for,
          domain: "wellness",
          event_type: "workout",
          title: p.title,
          dayLabel: when.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          timeLabel: when.toLocaleTimeString(undefined, {
            timeStyle: "short",
          }),
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Home
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Schedule
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          What&apos;s planned. Mark items done from the detail view to feed
          the timeline.
        </p>
      </header>

      {flash === "deleted" ? <Banner>Event deleted ✓</Banner> : null}

      <Link
        href="/schedule/new"
        className="block min-h-12 w-full rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        + Add to schedule
      </Link>

      <SuggestionsPanel suggestions={suggestions} />

      {habits.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Habits
            </h2>
            <Link
              href="/habits"
              className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              manage →
            </Link>
          </div>
          <ul className="space-y-1.5">
            {habits.map((h) => {
              const matching = (habitEvents ?? []).filter(
                (e) =>
                  e.domain === h.domain &&
                  (h.event_type === null || e.event_type === h.event_type),
              );
              const progress = computeHabitProgress(
                matching,
                h.target_frequency_per_week,
                new Date(h.started_at + "T00:00:00"),
              );
              const pct = Math.min(
                100,
                Math.round((progress.thisWeekCount / progress.target) * 100),
              );
              return (
                <li key={h.id}>
                  <Link
                    href={`/habits/${h.id}`}
                    className="block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {h.name}
                        {progress.streakWeeks > 0 ? (
                          <span className="ml-1.5 text-[11px] text-amber-600 dark:text-amber-300">
                            🔥{progress.streakWeeks}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {progress.thisWeekCount}/{progress.target}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-full ${
                          progress.thisWeekMet
                            ? "bg-emerald-500"
                            : progress.isStreakAlive
                              ? "bg-zinc-700 dark:bg-zinc-300"
                              : "bg-amber-400 dark:bg-amber-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {templates.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Recurring schedules
          </h2>
          <ul className="space-y-1.5">
            {templates.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/schedule/${t.id}`}
                  className="block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{t.title}</span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {describeRule(t.recurrence_rule)} ·{" "}
                      {formatTime(t.scheduled_for)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {t.domain} · {t.event_type} · started{" "}
                    {formatDate(t.scheduled_for)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sortedDays.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nothing on the schedule yet. Add the first thing above.
        </p>
      ) : (
        sortedDays.map((dayKey) => {
          const dayEvents = grouped.get(dayKey)!;
          return (
            <section key={dayKey} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {dayLabel(new Date(dayKey))}
              </h2>
              <ul className="space-y-1.5">
                {dayEvents.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/schedule/${e.id}`}
                      className="block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium">
                          {e.title}
                          {e.parent_scheduled_id ? (
                            <span
                              className="ml-1.5 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                              aria-label="part of a recurring series"
                            >
                              ↻
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatTime(e.scheduled_for)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {e.domain} · {e.event_type}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}
