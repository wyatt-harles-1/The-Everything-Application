// Per-domain "Coach says" generation. Each module hub calls the
// coach-advice API which lands here. Today's advice is cached in
// shared.coach_advice (UNIQUE on user+domain+date) so the LLM is hit
// at most once per domain per day. A force flag bypasses the cache
// when the user explicitly asks for fresh advice.

import "server-only";

import { generateText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { computeMesoProgress, type MesocycleRow } from "@/lib/lifting/mesocycle";
import { computeHabitProgress } from "@/lib/scheduler/streak";
import {
  formatDuration,
  formatPace,
  metersToMiles,
} from "@/lib/running/format";
import { getModelForUser } from "./provider";
import { listMemories, formatMemoriesForPrompt } from "./persistence";

export type CoachDomain = "lifting" | "running" | "health" | "goals";

function isoToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

// Domain-specific system prompts. Each one frames the coach's voice for
// that domain so the model writes useful advice instead of generic
// pleasantries.
const COACH_SYSTEM: Record<CoachDomain, string> = {
  lifting: `You are the user's lifting coach. Look at their active mesocycle, recent sessions, PRs, and rules. Give ONE specific, actionable suggestion for today - what to lift, when to push or pull back, which lift is lagging, whether they need a deload. Be terse: one or two sentences. Quote concrete numbers when you have them.`,
  running: `You are the user's running coach. Look at their recent mileage, paces, weekly trend, and rules. Give ONE specific suggestion for today - tempo run, easy day, rest, etc. Reference their current weekly volume when relevant. Be terse: one or two sentences.`,
  health: `You are the user's health-and-recovery coach. Look at recent sleep, mood, body composition, and medication adherence. Surface the most useful single insight for today - what to prioritize, what's drifting. Be terse: one or two sentences.`,
  goals: `You are the user's goals coach. Look at their active goals, priorities, and deadlines. Surface the one most relevant goal to focus on today, or flag a goal that's at risk of slipping. Be terse: one or two sentences.`,
};

// Gather the data each domain coach should see. Same primitives the
// read tools use; we just inline them so the model gets a compact JSON
// snapshot instead of paying a tool-roundtrip per fact.
async function gatherContext(
  supabase: SupabaseClient,
  domain: CoachDomain,
): Promise<Record<string, unknown>> {
  switch (domain) {
    case "lifting": {
      const [mesoRes, recentRes, rulesRes] = await Promise.all([
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
          .select("id, started_at, title, perceived_effort")
          .eq("kind", "lifting")
          .gte("started_at", isoDaysAgo(14))
          .order("started_at", { ascending: false })
          .limit(8),
        supabase
          .schema("wellness")
          .from("lifting_rules")
          .select(
            "frequency_per_week, preferred_days, default_time, skip_deload",
          )
          .maybeSingle(),
      ]);
      const meso = mesoRes.data as MesocycleRow | null;
      const progress = meso ? computeMesoProgress(meso) : null;
      return {
        today: isoToday(),
        active_mesocycle: meso
          ? {
              name: meso.name,
              current_week: progress?.currentWeek,
              planned_weeks: meso.planned_weeks,
              is_deload: progress?.isDeloadWeek ?? false,
              days_remaining: progress?.daysRemaining,
            }
          : null,
        recent_lifts: recentRes.data ?? [],
        lifting_rules: rulesRes.data ?? null,
      };
    }
    case "running": {
      const [recentRes, rulesRes] = await Promise.all([
        supabase
          .schema("wellness")
          .from("workouts")
          .select(
            "id, started_at, title, cardio_sessions(distance_meters, duration_seconds, avg_heart_rate)",
          )
          .eq("kind", "running")
          .gte("started_at", isoDaysAgo(28))
          .order("started_at", { ascending: false })
          .limit(8),
        supabase
          .schema("wellness")
          .from("running_rules")
          .select(
            "frequency_per_week, preferred_days, default_time, default_distance_meters",
          )
          .maybeSingle(),
      ]);
      type CardioRow = {
        distance_meters: number | null;
        duration_seconds: number | null;
        avg_heart_rate: number | null;
      };
      const runs = (recentRes.data ?? []).map((r) => {
        const c = (Array.isArray(r.cardio_sessions)
          ? r.cardio_sessions[0]
          : r.cardio_sessions) as CardioRow | null;
        return {
          when: r.started_at,
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
      const weekMiles = runs
        .filter(
          (r) =>
            new Date(r.when).getTime() >= Date.now() - 7 * 86400_000 &&
            r.miles !== null,
        )
        .reduce((s, r) => s + (r.miles ?? 0), 0);
      return {
        today: isoToday(),
        this_week_miles: Number(weekMiles.toFixed(2)),
        recent_runs: runs,
        running_rules: rulesRes.data ?? null,
      };
    }
    case "health": {
      const [
        sleepRes,
        weekSleepRes,
        moodRes,
        weekMoodRes,
        bodyRes,
        bodyOldRes,
        medsRes,
        todaysLogsRes,
      ] = await Promise.all([
        supabase
          .schema("wellness")
          .from("sleep_sessions")
          .select("start_at, end_at, quality")
          .order("end_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .schema("wellness")
          .from("sleep_sessions")
          .select("start_at, end_at, quality")
          .gte("end_at", isoDaysAgo(7)),
        supabase
          .schema("wellness")
          .from("mood_entries")
          .select("occurred_at, mood, energy, stress, anxiety, tags")
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .schema("wellness")
          .from("mood_entries")
          .select("mood")
          .gte("occurred_at", isoDaysAgo(7)),
        supabase
          .schema("wellness")
          .from("body_composition")
          .select("measured_at, weight_lbs, body_fat_pct")
          .order("measured_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .schema("wellness")
          .from("body_composition")
          .select("weight_lbs, measured_at")
          .lte("measured_at", isoDaysAgo(30))
          .order("measured_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .schema("wellness")
          .from("medications")
          .select("id, name, dosage")
          .is("ended_on", null),
        supabase
          .schema("wellness")
          .from("medication_logs")
          .select("medication_id, skipped")
          .gte(
            "taken_at",
            (() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              return d.toISOString();
            })(),
          ),
      ]);
      const weekSleepRows = weekSleepRes.data ?? [];
      const avgSleepMin =
        weekSleepRows.length > 0
          ? weekSleepRows.reduce(
              (s, r) =>
                s +
                (new Date(r.end_at).getTime() -
                  new Date(r.start_at).getTime()) /
                  60_000,
              0,
            ) / weekSleepRows.length
          : null;
      const moodVals = (weekMoodRes.data ?? []).map((m) => m.mood);
      const moodAvg =
        moodVals.length > 0
          ? moodVals.reduce((s, n) => s + n, 0) / moodVals.length
          : null;
      const weightDelta =
        bodyRes.data?.weight_lbs != null &&
        bodyOldRes.data?.weight_lbs != null
          ? Number(bodyRes.data.weight_lbs) -
            Number(bodyOldRes.data.weight_lbs)
          : null;
      return {
        today: isoToday(),
        latest_sleep: sleepRes.data,
        sleep_7d_avg_minutes: avgSleepMin ? Math.round(avgSleepMin) : null,
        latest_mood: moodRes.data,
        mood_7d_avg: moodAvg ? Number(moodAvg.toFixed(1)) : null,
        latest_body: bodyRes.data,
        weight_delta_30d: weightDelta,
        active_medications: medsRes.data ?? [],
        today_medication_logs: todaysLogsRes.data ?? [],
      };
    }
    case "goals": {
      const [activeRes, habitsRes, habitEventsRes] = await Promise.all([
        supabase
          .schema("shared")
          .from("goals")
          .select(
            "id, title, domain, category, target_metric, target_value, target_date, priority",
          )
          .eq("status", "active")
          .order("priority", { ascending: true })
          .limit(8),
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
      ]);
      const habits = (habitsRes.data ?? []).map((h) => {
        const matching = (habitEventsRes.data ?? []).filter(
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
          target_per_week: p.target,
          this_week_count: p.thisWeekCount,
          this_week_met: p.thisWeekMet,
          streak_weeks: p.streakWeeks,
        };
      });
      const goals = (activeRes.data ?? []).map((g) => ({
        ...g,
        days_remaining: g.target_date
          ? Math.ceil(
              (new Date(g.target_date + "T23:59:59").getTime() - Date.now()) /
                86400_000,
            )
          : null,
      }));
      return {
        today: isoToday(),
        active_goals: goals,
        habits,
      };
    }
  }
}

export async function getOrGenerateCoachAdvice(args: {
  supabase: SupabaseClient;
  userId: string;
  domain: CoachDomain;
  force?: boolean;
}): Promise<{ advice: string; generated_at: string; from_cache: boolean }> {
  const { supabase, userId, domain, force } = args;
  const today = isoToday();

  // Cache hit?
  if (!force) {
    const { data: existing } = await supabase
      .schema("shared")
      .from("coach_advice")
      .select("advice, created_at")
      .eq("domain", domain)
      .eq("generated_for_date", today)
      .maybeSingle();
    if (existing) {
      return {
        advice: existing.advice,
        generated_at: existing.created_at,
        from_cache: true,
      };
    }
  }

  // Cache miss / force: generate fresh.
  const { model } = await getModelForUser(supabase, userId);
  const context = await gatherContext(supabase, domain);
  const memories = await listMemories(supabase);
  const memoryBlock = formatMemoriesForPrompt(memories);

  const { text } = await generateText({
    model,
    system: COACH_SYSTEM[domain] + memoryBlock,
    prompt: `Here is the relevant data as JSON:\n\n${JSON.stringify(context, null, 2)}\n\nWrite the advice now. One or two sentences. No preamble.`,
  });
  const advice = text.trim();

  // Upsert on the unique (user, domain, date) constraint.
  await supabase
    .schema("shared")
    .from("coach_advice")
    .upsert(
      {
        user_id: userId,
        domain,
        generated_for_date: today,
        advice,
        context_snapshot: context,
      },
      { onConflict: "user_id,domain,generated_for_date" },
    );

  return {
    advice,
    generated_at: new Date().toISOString(),
    from_cache: false,
  };
}
