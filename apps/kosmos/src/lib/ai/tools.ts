// Read-only tools the master agent can call (Phase 4e2). Each tool is
// scoped to the user's data via the same RLS-protected supabase client
// the UI uses, so there's no path for an LLM to read someone else's row.
//
// Tool design rules:
//  - One purpose per tool, short descriptions the model can grep mentally
//  - Inputs validated with Zod (AI SDK requires zod inputSchema)
//  - Returns small, structured objects - never raw DB rows that could
//    bloat context. Tool results are token cost on every step.
//  - No mutations - those land in 4e3. If a tool sounds like an action,
//    it doesn't belong here.

import "server-only";

import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CoachDomain } from "./coach";
import {
  computeMesoProgress,
  type MesocycleRow,
} from "@/lib/lifting/mesocycle";
import { computeHabitProgress } from "@/lib/scheduler/streak";
import {
  metersToMiles,
  formatPace,
  formatDuration,
} from "@/lib/running/format";

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

// The supabase client carries the user's auth context, so RLS scopes
// every read automatically. We keep the signature open in case future
// tools want a fast-path user id (e.g., generated columns).
export function buildReadTools(supabase: SupabaseClient) {
  return {
    // ------------------------------------------------------------------
    get_today_summary: tool({
      description:
        "One-shot daily briefing for the user. Returns today's planned events, the active mesocycle (with week/N), top 3 active goals, and active habits with this-week progress. Call this first when the user asks general 'how's today/this week going' questions before reaching for narrower tools.",
      inputSchema: z.object({}),
      execute: async () => {
        const todayStart = startOfTodayISO();
        const tomorrowStart = new Date(
          new Date(todayStart).getTime() + 86400_000,
        ).toISOString();

        const [
          scheduledRes,
          mesoRes,
          goalsRes,
          habitsRes,
          habitEventsRes,
          inProgressRes,
        ] = await Promise.all([
          supabase
            .schema("shared")
            .from("scheduled_events")
            .select("title, domain, event_type, scheduled_for")
            .eq("status", "planned")
            .is("recurrence_rule", null)
            .gte("scheduled_for", todayStart)
            .lt("scheduled_for", tomorrowStart)
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
            .schema("shared")
            .from("goals")
            .select(
              "title, domain, target_metric, target_value, target_date, priority",
            )
            .eq("status", "active")
            .order("priority", { ascending: true })
            .limit(3),
          supabase
            .schema("shared")
            .from("habits")
            .select(
              "id, name, domain, event_type, target_frequency_per_week, started_at",
            )
            .eq("active", true),
          supabase
            .schema("shared")
            .from("events")
            .select("domain, event_type, occurred_at")
            .gte("occurred_at", isoDaysAgo(60)),
          supabase
            .schema("wellness")
            .from("workouts")
            .select("id, title, started_at")
            .eq("kind", "lifting")
            .is("ended_at", null)
            .maybeSingle(),
        ]);

        const meso = mesoRes.data as MesocycleRow | null;
        const mesoProgress = meso ? computeMesoProgress(meso) : null;

        const habits = (habitsRes.data ?? []).map((h) => {
          const matching = (habitEventsRes.data ?? []).filter(
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
            name: h.name,
            target_per_week: progress.target,
            this_week: progress.thisWeekCount,
            streak_weeks: progress.streakWeeks,
            on_track: progress.thisWeekMet || progress.isStreakAlive,
          };
        });

        return {
          today_planned: (scheduledRes.data ?? []).map((s) => ({
            title: s.title,
            when: s.scheduled_for,
            domain: s.domain,
            event_type: s.event_type,
          })),
          active_session: inProgressRes.data
            ? {
                id: inProgressRes.data.id,
                title: inProgressRes.data.title,
                started_at: inProgressRes.data.started_at,
              }
            : null,
          active_mesocycle: meso
            ? {
                name: meso.name,
                week: mesoProgress?.currentWeek,
                of: meso.planned_weeks,
                is_deload: mesoProgress?.isDeloadWeek ?? false,
              }
            : null,
          top_goals: (goalsRes.data ?? []).map((g) => ({
            title: g.title,
            domain: g.domain,
            target_metric: g.target_metric,
            target_value: g.target_value,
            target_date: g.target_date,
            priority: g.priority,
          })),
          habits,
        };
      },
    }),

    // ------------------------------------------------------------------
    query_events: tool({
      description:
        "Read recent entries from the universal timeline (shared.events). Use this for cross-domain history questions like 'what did I do yesterday' or 'how many meals did I log last week'. Filter by domain (wellness/productivity/finance/knowledge/shared) and/or event_type (workout/meal/mood/sleep/etc).",
      inputSchema: z.object({
        domain: z
          .enum([
            "wellness",
            "productivity",
            "finance",
            "knowledge",
            "shared",
          ])
          .optional()
          .describe("Narrow to one domain. Omit for all."),
        event_type: z
          .string()
          .optional()
          .describe(
            "Filter event_type (e.g. 'workout', 'meal', 'mood'). Omit for all.",
          ),
        days: z
          .number()
          .int()
          .min(1)
          .max(180)
          .default(7)
          .describe("How many days back to include."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25)
          .describe("Max rows returned."),
      }),
      execute: async ({ domain, event_type, days, limit }) => {
        let q = supabase
          .schema("shared")
          .from("events")
          .select(
            "occurred_at, domain, event_type, title, summary, duration_minutes",
          )
          .gte("occurred_at", isoDaysAgo(days))
          .order("occurred_at", { ascending: false })
          .limit(limit);
        if (domain) q = q.eq("domain", domain);
        if (event_type) q = q.eq("event_type", event_type);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { count: data?.length ?? 0, events: data ?? [] };
      },
    }),

    // ------------------------------------------------------------------
    query_workouts: tool({
      description:
        "Recent workouts (lifting / running / cycling / swimming / walk / mobility / sport). Returns parent rows with kind + duration; use get_lift_pr or query_recent_runs for kind-specific detail.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(180).default(14),
        kind: z
          .enum([
            "lifting",
            "running",
            "cycling",
            "swimming",
            "mobility",
            "walk",
            "sport",
            "other",
          ])
          .optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ days, kind, limit }) => {
        let q = supabase
          .schema("wellness")
          .from("workouts")
          .select(
            "id, started_at, ended_at, kind, title, perceived_effort",
          )
          .gte("started_at", isoDaysAgo(days))
          .order("started_at", { ascending: false })
          .limit(limit);
        if (kind) q = q.eq("kind", kind);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { count: data?.length ?? 0, workouts: data ?? [] };
      },
    }),

    // ------------------------------------------------------------------
    get_lift_pr: tool({
      description:
        "Personal record (best e1RM) for a specific lifting exercise. Fuzzy-matches the name (e.g. 'bench' matches 'Bench Press', 'Incline Bench'). Returns the top match + a few runner-up candidates if the match was ambiguous.",
      inputSchema: z.object({
        exercise_name: z
          .string()
          .min(1)
          .describe("Partial name; matched case-insensitively"),
      }),
      execute: async ({ exercise_name }) => {
        // Find candidate exercises (the library, not just sets).
        const { data: exs } = await supabase
          .schema("wellness")
          .from("exercises")
          .select("id, name, muscle_group")
          .ilike("name", `%${exercise_name}%`)
          .eq("is_active", true)
          .limit(5);
        if (!exs || exs.length === 0) {
          return { matched: null, candidates: [], pr: null };
        }
        const top = exs[0];
        const { data: best } = await supabase
          .schema("wellness")
          .from("lifting_sets")
          .select("e1rm_lbs, weight_lbs, reps, completed_at")
          .eq("exercise_id", top.id)
          .not("completed_at", "is", null)
          .not("e1rm_lbs", "is", null)
          .order("e1rm_lbs", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          matched: { name: top.name, muscle_group: top.muscle_group },
          candidates: exs.slice(1).map((e) => e.name),
          pr: best
            ? {
                e1rm_lbs: Number(best.e1rm_lbs),
                weight_lbs: best.weight_lbs != null ? Number(best.weight_lbs) : null,
                reps: best.reps,
                achieved_at: best.completed_at,
              }
            : null,
        };
      },
    }),

    // ------------------------------------------------------------------
    get_active_mesocycle: tool({
      description:
        "Current active mesocycle: name, current week N of X, whether it's the deload week, days remaining. Returns null if no block is active.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await supabase
          .schema("wellness")
          .from("mesocycles")
          .select(
            "id, name, started_at, planned_weeks, deload_week_number, ended_at, notes",
          )
          .is("ended_at", null)
          .maybeSingle();
        if (!data) return { active: null };
        const meso = data as MesocycleRow & { notes: string | null };
        const p = computeMesoProgress(meso);
        return {
          active: {
            name: meso.name,
            started_at: meso.started_at,
            current_week: p.currentWeek,
            planned_weeks: meso.planned_weeks,
            is_deload_week: p.isDeloadWeek,
            days_remaining: p.daysRemaining,
            notes: meso.notes,
          },
        };
      },
    }),

    // ------------------------------------------------------------------
    query_habits: tool({
      description:
        "All active habits with this-week progress and current streak. Use this when the user asks about their habits or consistency.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: habits } = await supabase
          .schema("shared")
          .from("habits")
          .select(
            "id, name, domain, event_type, target_frequency_per_week, started_at, active",
          )
          .eq("active", true);
        const { data: events } = await supabase
          .schema("shared")
          .from("events")
          .select("domain, event_type, occurred_at")
          .gte("occurred_at", isoDaysAgo(60));
        const out = (habits ?? []).map((h) => {
          const matching = (events ?? []).filter(
            (e) =>
              e.domain === h.domain &&
              (h.event_type === null || e.event_type === h.event_type),
          );
          const p = computeHabitProgress(
            matching,
            h.target_frequency_per_week,
            new Date(h.started_at + "T00:00:00"),
          );
          return {
            name: h.name,
            domain: h.domain,
            event_type: h.event_type,
            target_per_week: p.target,
            this_week_count: p.thisWeekCount,
            this_week_met: p.thisWeekMet,
            streak_weeks: p.streakWeeks,
            on_track: p.thisWeekMet || p.isStreakAlive,
          };
        });
        return { count: out.length, habits: out };
      },
    }),

    // ------------------------------------------------------------------
    query_goals: tool({
      description:
        "Goals filtered by status (active by default). Each row carries priority, target metric/value, target date, and days remaining (negative when overdue).",
      inputSchema: z.object({
        status: z
          .enum(["active", "paused", "achieved", "abandoned"])
          .default("active"),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ status, limit }) => {
        const { data, error } = await supabase
          .schema("shared")
          .from("goals")
          .select(
            "title, domain, category, target_metric, target_value, target_date, priority, status",
          )
          .eq("status", status)
          .order("priority", { ascending: true })
          .limit(limit);
        if (error) return { error: error.message };
        const goals = (data ?? []).map((g) => {
          let days_remaining: number | null = null;
          if (g.target_date) {
            const target = new Date(g.target_date + "T23:59:59");
            days_remaining = Math.ceil(
              (target.getTime() - Date.now()) / 86400_000,
            );
          }
          return { ...g, days_remaining };
        });
        return { count: goals.length, goals };
      },
    }),

    // ------------------------------------------------------------------
    query_recent_runs: tool({
      description:
        "Recent runs with miles, duration, pace, and avg HR. Pace is computed at read time from distance/duration.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(180).default(28),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ days, limit }) => {
        const { data, error } = await supabase
          .schema("wellness")
          .from("workouts")
          .select(
            "id, started_at, title, cardio_sessions(distance_meters, duration_seconds, avg_heart_rate)",
          )
          .eq("kind", "running")
          .gte("started_at", isoDaysAgo(days))
          .order("started_at", { ascending: false })
          .limit(limit);
        if (error) return { error: error.message };
        type CardioRow = {
          distance_meters: number | null;
          duration_seconds: number | null;
          avg_heart_rate: number | null;
        };
        const runs = (data ?? []).map((r) => {
          const c = (Array.isArray(r.cardio_sessions)
            ? r.cardio_sessions[0]
            : r.cardio_sessions) as CardioRow | null;
          return {
            id: r.id,
            when: r.started_at,
            title: r.title,
            miles:
              c?.distance_meters != null
                ? Number(metersToMiles(Number(c.distance_meters)).toFixed(2))
                : null,
            duration: formatDuration(c?.duration_seconds ?? null),
            pace: formatPace(
              c?.duration_seconds ?? null,
              c?.distance_meters ?? null,
            ),
            avg_hr: c?.avg_heart_rate ?? null,
          };
        });
        return { count: runs.length, runs };
      },
    }),

    // ------------------------------------------------------------------
    query_sleep: tool({
      description:
        "Recent sleep sessions with duration (min) and quality (1-10).",
      inputSchema: z.object({
        days: z.number().int().min(1).max(60).default(14),
      }),
      execute: async ({ days }) => {
        const { data } = await supabase
          .schema("wellness")
          .from("sleep_sessions")
          .select("start_at, end_at, quality, interruptions, notes")
          .gte("end_at", isoDaysAgo(days))
          .order("end_at", { ascending: false });
        const sessions = (data ?? []).map((s) => ({
          start_at: s.start_at,
          end_at: s.end_at,
          duration_minutes: Math.round(
            (new Date(s.end_at).getTime() -
              new Date(s.start_at).getTime()) /
              60_000,
          ),
          quality: s.quality,
          interruptions: s.interruptions,
          notes: s.notes,
        }));
        return { count: sessions.length, sessions };
      },
    }),

    // ------------------------------------------------------------------
    query_mood: tool({
      description:
        "Recent mood entries. Each carries mood/energy/stress/anxiety 1-10 scales plus optional tags.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(60).default(14),
      }),
      execute: async ({ days }) => {
        const { data } = await supabase
          .schema("wellness")
          .from("mood_entries")
          .select(
            "occurred_at, mood, energy, stress, anxiety, tags, notes",
          )
          .gte("occurred_at", isoDaysAgo(days))
          .order("occurred_at", { ascending: false });
        return { count: data?.length ?? 0, entries: data ?? [] };
      },
    }),

    // ------------------------------------------------------------------
    query_readiness: tool({
      description:
        "Recent daily recovery from Oura (wellness.readiness): readiness score (0-100), average HRV (ms), resting heart rate (bpm), and body-temperature deviation (°C). Use for recovery questions and for correlating recovery against training (e.g. 'how did my readiness track with my lifts last week'). Empty if Oura isn't connected.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(90).default(14),
      }),
      execute: async ({ days }) => {
        const { data } = await supabase
          .schema("wellness")
          .from("readiness")
          .select("day, score, hrv_avg, resting_hr, temp_deviation")
          .gte("day", isoDaysAgo(days).slice(0, 10))
          .order("day", { ascending: false });
        return { count: data?.length ?? 0, entries: data ?? [] };
      },
    }),

    // ------------------------------------------------------------------
    get_lifting_rules: tool({
      description:
        "The user's current lifting-module rules row (invariant #8). Includes weekly frequency, preferred days, default time, skip_deload flag. Returns nulls when no row exists yet (defaults will be used).",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await supabase
          .schema("wellness")
          .from("lifting_rules")
          .select(
            "frequency_per_week, preferred_days, default_time, skip_deload, notes",
          )
          .maybeSingle();
        return { rules: data ?? null };
      },
    }),

    // ------------------------------------------------------------------
    get_running_rules: tool({
      description:
        "The user's current running-module rules row (invariant #8). Frequency, preferred days, default time, default distance (meters), active_shoe_id.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await supabase
          .schema("wellness")
          .from("running_rules")
          .select(
            "frequency_per_week, preferred_days, default_time, default_distance_meters, active_shoe_id, notes",
          )
          .maybeSingle();
        return { rules: data ?? null };
      },
    }),
  };
}

// Which read tools each specialist sub-agent gets (Phase 4e7). The master
// agent keeps the full set above; a specialist only sees its domain's slice
// so it stays focused and picks the right tool. query_workouts deliberately
// appears under both lifting and running since it's the parent-workout read
// for either kind. These are names into buildReadTools, so there's exactly
// one definition per tool - no drift between the master and the specialists.
type ReadToolName = keyof ReturnType<typeof buildReadTools>;

const DOMAIN_READ_TOOL_NAMES: Record<CoachDomain, ReadToolName[]> = {
  lifting: [
    "query_workouts",
    "get_lift_pr",
    "get_active_mesocycle",
    "get_lifting_rules",
  ],
  running: ["query_workouts", "query_recent_runs", "get_running_rules"],
  health: ["query_sleep", "query_mood", "query_readiness"],
  goals: ["query_goals", "query_habits"],
};

// Build the scoped read-tool subset for one specialist domain. We construct
// the full tool object (cheap - no DB calls happen until a tool executes)
// and pick the domain's slice by name, so the definitions never diverge.
export function buildDomainReadTools(
  supabase: SupabaseClient,
  domain: CoachDomain,
) {
  const all = buildReadTools(supabase);
  const names = DOMAIN_READ_TOOL_NAMES[domain];
  return Object.fromEntries(names.map((n) => [n, all[n]]));
}
