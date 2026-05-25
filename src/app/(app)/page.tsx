// Authenticated home / Life Hub dashboard. Replaces the Phase 2 minimal
// landing page with a daily-briefing layout: what's on today, where my
// training stands, how my habits + goals are going, what I recently
// logged. Everything links into the module pages for deeper context.
//
// Mobile-first single column. Most users open the app on a phone in the
// morning - the goal of this page is "see the state of your life at a
// glance, without scrolling, without tapping."

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatTime } from "@/lib/format";
import {
  computeHabitProgress,
  startOfISOWeek,
} from "@/lib/scheduler/streak";
import {
  computeMesoProgress,
  formatMesoStatusShort,
  type MesocycleRow,
} from "@/lib/lifting/mesocycle";

import { GoalCard, type GoalForCard } from "./goals/GoalCard";
import { HabitCard } from "./habits/HabitCard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Today bounds: midnight to midnight in server-local time. Good enough
  // for daily granularity; full TZ-aware bounds wait for the timezone
  // polish pass.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  // Parallelize every query - server component is async-friendly and
  // these are all independent table reads.
  const [
    todaysScheduledRes,
    activeMesoRes,
    inProgressSessionRes,
    habitsRes,
    habitEventsRes,
    topGoalsRes,
    latestEventsRes,
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
    // 60-day event window for habit progress + recent activity. One query,
    // re-used twice below.
    supabase
      .schema("shared")
      .from("events")
      .select("domain, event_type, title, summary, occurred_at, detail_table, detail_id")
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
  ]);

  const todaysScheduled = todaysScheduledRes.data ?? [];
  const activeMeso = activeMesoRes.data as MesocycleRow | null;
  const mesoProgress = activeMeso ? computeMesoProgress(activeMeso) : null;
  const inProgressSession = inProgressSessionRes.data;
  const habits = habitsRes.data ?? [];
  const habitEvents = habitEventsRes.data ?? [];
  const topGoals = (topGoalsRes.data ?? []) as GoalForCard[];
  const latestEvents = latestEventsRes.data ?? [];

  // No data at all? Show an onboarding nudge. Otherwise full briefing.
  const isEmpty =
    todaysScheduled.length === 0 &&
    !activeMeso &&
    !inProgressSession &&
    habits.length === 0 &&
    topGoals.length === 0 &&
    latestEvents.length === 0;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Life Hub
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {user!.email}
        </p>
      </header>

      {isEmpty ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nothing logged yet. Try a quick log below or set up a habit /
          goal to start tracking.
        </p>
      ) : null}

      {/* TODAY ----------------------------------------------------------- */}
      {todaysScheduled.length > 0 || inProgressSession ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Today
          </h2>
          {inProgressSession ? (
            <Link
              href={`/lifting/session/${inProgressSession.id}`}
              className="block rounded-lg border border-emerald-300 bg-emerald-50 p-4 transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                In progress
              </p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                Resume {inProgressSession.title ?? "session"} →
              </p>
              <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                Started {formatDateTime(inProgressSession.started_at)}
              </p>
            </Link>
          ) : null}
          {todaysScheduled.length > 0 ? (
            <ul className="space-y-1.5">
              {todaysScheduled.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/schedule/${s.id}`}
                    className="block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{s.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatTime(s.scheduled_for)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {s.domain} · {s.event_type}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {/* TRAINING CONTEXT ------------------------------------------------- */}
      {activeMeso && mesoProgress ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Training block
          </h2>
          <Link
            href={`/lifting/mesocycles/${activeMeso.id}`}
            className="block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{activeMeso.name}</span>
              <span
                className={`shrink-0 text-xs ${
                  mesoProgress.isDeloadWeek
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {formatMesoStatusShort(mesoProgress, activeMeso.planned_weeks)}
              </span>
            </div>
          </Link>
        </section>
      ) : null}

      {/* HABITS ----------------------------------------------------------- */}
      {habits.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Habits this week
            </h2>
            <Link
              href="/habits"
              className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              all →
            </Link>
          </div>
          <ul className="space-y-1.5">
            {habits.map((h) => {
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
              return (
                <li key={h.id}>
                  <HabitCard
                    habit={{
                      id: h.id,
                      name: h.name,
                      domain: h.domain,
                      event_type: h.event_type,
                    }}
                    progress={progress}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* TOP GOALS -------------------------------------------------------- */}
      {topGoals.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Top goals
            </h2>
            <Link
              href="/goals"
              className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              all →
            </Link>
          </div>
          <ul className="space-y-1.5">
            {topGoals.map((g) => (
              <li key={g.id}>
                <GoalCard goal={g} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* QUICK LOG -------------------------------------------------------- */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Quick log
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickLink href="/log/workout/new" label="Workout" />
          <QuickLink href="/log/meal/new" label="Meal" />
          <QuickLink href="/log/sleep/new" label="Sleep" />
          <QuickLink href="/log/mood/new" label="Mood" />
        </div>
      </section>

      {/* SECTIONS NAV ---------------------------------------------------- */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Sections
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <QuickLink href="/schedule" label="Schedule" />
          <QuickLink href="/habits" label="Habits" />
          <QuickLink href="/goals" label="Goals" />
          <QuickLink href="/lifting" label="Lifting" />
          <QuickLink href="/running" label="Running" />
          <QuickLink href="/health" label="Health" />
        </div>
      </section>

      {/* RECENT ACTIVITY ------------------------------------------------- */}
      {latestEvents.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Recent activity
            </h2>
            <Link
              href="/log"
              className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              full log →
            </Link>
          </div>
          <ul className="space-y-1">
            {latestEvents.map((e, idx) => (
              <li
                key={`${e.occurred_at}-${idx}`}
                className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">
                    {e.title ?? e.event_type}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(e.occurred_at)}
                  </span>
                </div>
                {e.summary ? (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {e.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// Hour-of-day greeting. Server-rendered uses server clock; for personal
// use this is fine - small TZ skew between 12am-1am is harmless.
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Wind down";
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm font-medium shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
    >
      {label}
    </Link>
  );
}
