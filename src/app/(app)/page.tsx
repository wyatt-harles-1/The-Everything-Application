// Authenticated home / Life Hub dashboard. A daily-briefing layout: what's on
// today, where my training stands, how my habits + goals are going, what I
// recently logged. Everything links into the module pages for deeper context.
//
// This server component owns ALL data fetching, then hands the rendered widget
// nodes to <HomeDashboard> (client), which renders them in the user's saved
// order and provides an edit mode to reorder/hide. Keeping fetch here means the
// customization layer adds no client-side data loading.

import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";
import { computeHabitProgress } from "@/lib/scheduler/streak";
import {
  computeMesoProgress,
  type MesocycleRow,
} from "@/lib/lifting/mesocycle";
import {
  WIDGET_LABELS,
  normalizeOrder,
  normalizeHidden,
  type HomeWidgetId,
} from "@/lib/home/layout";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
} from "date-fns";

import {
  sleepTrend,
  moodTrend,
  weightTrend,
  trainingLoadTrend,
} from "@/lib/analytics/metrics";
import { fetchCalendarItems } from "@/lib/calendar/data";

import { HomeDashboard, type HomeWidget } from "./home/HomeDashboard";
import { TodayWidget } from "./home/widgets/TodayWidget";
import { TrainingWidget } from "./home/widgets/TrainingWidget";
import { HabitsWidget, type HabitItem } from "./home/widgets/HabitsWidget";
import { GoalsWidget } from "./home/widgets/GoalsWidget";
import { QuickLogWidget } from "./home/widgets/QuickLogWidget";
import { SectionsWidget } from "./home/widgets/SectionsWidget";
import { RecentWidget } from "./home/widgets/RecentWidget";
import { CalendarWidget } from "./home/widgets/CalendarWidget";
import { SleepChartWidget } from "./home/widgets/SleepChartWidget";
import { WeightTrendWidget } from "./home/widgets/WeightTrendWidget";
import { MoodTrendWidget } from "./home/widgets/MoodTrendWidget";
import { TrainingLoadWidget } from "./home/widgets/TrainingLoadWidget";
import { type GoalForCard } from "./goals/GoalCard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the page safe if it's ever rendered without a session.
  if (!user) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  // Visible range for the home calendar widget = the current month's grid
  // (including leading/trailing days from adjacent months).
  const monthGridStart = startOfWeek(startOfMonth(todayStart), { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(endOfMonth(todayStart), { weekStartsOn: 1 });

  const [
    todaysScheduledRes,
    activeMesoRes,
    inProgressSessionRes,
    habitsRes,
    habitEventsRes,
    topGoalsRes,
    latestEventsRes,
    prefsRes,
    sleepT,
    moodT,
    weightT,
    trainingT,
    calendarItems,
  ] = await Promise.all([
    supabase
      .schema("shared")
      .from("scheduled_events")
      .select(
        "id, domain, event_type, scheduled_for, title, status, parent_scheduled_id",
      )
      .eq("status", "planned")
      .is("recurrence_rule", null)
      .gte("scheduled_for", todayStart.toISOString())
      .lt("scheduled_for", tomorrowStart.toISOString())
      .order("scheduled_for", { ascending: true }),
    supabase
      .schema("wellness")
      .from("mesocycles")
      .select(
        "id, name, started_at, planned_weeks, deload_week_number, ended_at",
      )
      .is("ended_at", null)
      .maybeSingle(),
    supabase
      .schema("wellness")
      .from("workouts")
      .select("id, started_at, title")
      .eq("kind", "lifting")
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("shared")
      .from("habits")
      .select(
        "id, name, domain, event_type, target_frequency_per_week, started_at",
      )
      .eq("active", true)
      .order("started_at", { ascending: false })
      .limit(4),
    supabase
      .schema("shared")
      .from("events")
      .select(
        "domain, event_type, title, summary, occurred_at, detail_table, detail_id",
      )
      .gte(
        "occurred_at",
        new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("occurred_at", { ascending: false }),
    supabase
      .schema("shared")
      .from("goals")
      .select(
        "id, title, domain, category, target_metric, target_value, target_date, priority, status",
      )
      .eq("status", "active")
      .order("priority", { ascending: true })
      .limit(3),
    supabase
      .schema("shared")
      .from("events")
      .select("event_type, title, summary, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(6),
    // Saved home layout. Wrapped query — if user_preferences doesn't exist yet
    // the error is swallowed by Supabase (data:null) and we fall back to the
    // default order.
    supabase
      .schema("shared")
      .from("user_preferences")
      .select("home_layout")
      .eq("user_id", user.id)
      .maybeSingle(),
    // Chart-widget trends (each returns { points: [] } when the user has no
    // data, so the matching widget self-hides below).
    sleepTrend(supabase, 30),
    moodTrend(supabase, 30),
    weightTrend(supabase, 90),
    trainingLoadTrend(supabase, 12),
    fetchCalendarItems(
      supabase,
      monthGridStart.toISOString(),
      addDays(monthGridEnd, 1).toISOString(),
    ),
  ]);

  const todaysScheduled = todaysScheduledRes.data ?? [];
  const activeMeso = activeMesoRes.data as MesocycleRow | null;
  const mesoProgress = activeMeso ? computeMesoProgress(activeMeso) : null;
  const inProgressSession = inProgressSessionRes.data;
  const habits = habitsRes.data ?? [];
  const habitEvents = habitEventsRes.data ?? [];
  const topGoals = (topGoalsRes.data ?? []) as GoalForCard[];
  const latestEvents = latestEventsRes.data ?? [];

  const savedLayout = (prefsRes.data?.home_layout ?? null) as {
    order?: string[];
    hidden?: string[];
  } | null;

  // Precompute habit progress on the server so HabitsWidget stays presentational.
  const habitItems: HabitItem[] = habits.map((h) => {
    const matching = habitEvents.filter(
      (e) =>
        e.domain === h.domain &&
        (h.event_type === null || e.event_type === h.event_type),
    );
    const progress = computeHabitProgress(
      matching,
      h.target_frequency_per_week,
      new Date(h.started_at + "T00:00:00"),
    );
    return {
      habit: {
        id: h.id,
        name: h.name,
        domain: h.domain,
        event_type: h.event_type,
      },
      progress,
    };
  });

  // Build each widget's node, or null when it has nothing to show. Quick log +
  // Sections are always present; the rest self-hide when empty.
  const nodes: Record<HomeWidgetId, ReactNode | null> = {
    today:
      todaysScheduled.length > 0 || inProgressSession ? (
        <TodayWidget
          inProgressSession={inProgressSession ?? null}
          scheduled={todaysScheduled}
        />
      ) : null,
    training:
      activeMeso && mesoProgress ? (
        <TrainingWidget meso={activeMeso} progress={mesoProgress} />
      ) : null,
    habits: habitItems.length > 0 ? <HabitsWidget items={habitItems} /> : null,
    goals: topGoals.length > 0 ? <GoalsWidget goals={topGoals} /> : null,
    sleepchart:
      sleepT.points.length > 0 ? <SleepChartWidget trend={sleepT} /> : null,
    trainingload:
      trainingT.points.length > 0 ? (
        <TrainingLoadWidget trend={trainingT} />
      ) : null,
    weighttrend:
      weightT.points.length > 0 ? <WeightTrendWidget trend={weightT} /> : null,
    moodtrend:
      moodT.points.length > 0 ? <MoodTrendWidget trend={moodT} /> : null,
    quicklog: <QuickLogWidget />,
    sections: <SectionsWidget />,
    recent: latestEvents.length > 0 ? <RecentWidget events={latestEvents} /> : null,
    // Always present — a calendar is useful even with no items this month.
    calendar: <CalendarWidget items={calendarItems} />,
  };

  const widgets: HomeWidget[] = (Object.keys(nodes) as HomeWidgetId[])
    .filter((id) => nodes[id] !== null)
    .map((id) => ({ id, label: WIDGET_LABELS[id], node: nodes[id] }));

  const isEmpty =
    todaysScheduled.length === 0 &&
    !activeMeso &&
    !inProgressSession &&
    habits.length === 0 &&
    topGoals.length === 0 &&
    latestEvents.length === 0;

  return (
    <div className="space-y-[var(--gap-section)]">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Kosmos</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
          {greeting()}
        </h1>
        <p className="text-sm text-muted">{user.email}</p>
      </header>

      {isEmpty ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-sm text-muted">
          Nothing logged yet. Tap the + button below to log something, or set up
          a habit / goal to start tracking.
        </p>
      ) : null}

      <HomeDashboard
        widgets={widgets}
        initialOrder={normalizeOrder(savedLayout?.order)}
        initialHidden={normalizeHidden(savedLayout?.hidden)}
      />
    </div>
  );
}

// Hour-of-day greeting. Server clock; small TZ skew at midnight is harmless for
// personal use.
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Wind down";
}
