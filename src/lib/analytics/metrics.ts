// Per-metric trend builders. Each runs the same queries the health coach uses
// (src/lib/ai/coach.ts gatherContext) and returns a TrendResult ready for a
// chart card. An empty dataset yields { points: [], series: [] } so the calling
// widget/section can self-hide. Server-only (uses the RLS-scoped client).

import "server-only";

import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import { dayKey, weekKey, lastNDays, lastNWeeks, avg1 } from "./buckets";
import type { TrendResult } from "./types";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

// Nightly sleep duration (summed per day) + quality, over `days` days.
export async function sleepTrend(
  supabase: SupabaseClient,
  days = 30,
): Promise<TrendResult> {
  const { data } = await supabase
    .schema("wellness")
    .from("sleep_sessions")
    .select("start_at, end_at, quality")
    .gte("end_at", isoDaysAgo(days));
  const rows = data ?? [];
  if (rows.length === 0) return { points: [], series: [] };

  const byDay = new Map<string, { dur: number; q: number[] }>();
  for (const r of rows) {
    const k = dayKey(new Date(r.end_at));
    const slot = byDay.get(k) ?? { dur: 0, q: [] };
    const hours =
      (new Date(r.end_at).getTime() - new Date(r.start_at).getTime()) / 3_600_000;
    if (hours > 0 && hours < 24) slot.dur += hours;
    if (r.quality != null) slot.q.push(r.quality);
    byDay.set(k, slot);
  }

  const points = lastNDays(days).map((b) => {
    const s = byDay.get(b.key);
    return {
      x: b.label,
      hours: s && s.dur > 0 ? Math.round(s.dur * 10) / 10 : null,
      quality: s ? avg1(s.q) : null,
    };
  });

  const last7 = points
    .slice(-7)
    .map((p) => p.hours)
    .filter((n): n is number => n != null);

  return {
    points,
    series: [{ key: "hours", label: "Sleep (h)" }],
    summary: { avg7d: avg1(last7) },
  };
}

// Oura daily readiness: score / HRV / resting HR. readiness.day is already a
// "yyyy-MM-dd" string, matching our bucket keys.
export async function readinessTrend(
  supabase: SupabaseClient,
  days = 30,
): Promise<TrendResult> {
  const { data } = await supabase
    .schema("wellness")
    .from("readiness")
    .select("day, score, hrv_avg, resting_hr")
    .gte("day", isoDaysAgo(days).slice(0, 10))
    .order("day", { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return { points: [], series: [] };

  const byDay = new Map(rows.map((r) => [r.day as string, r]));
  const points = lastNDays(days).map((b) => {
    const r = byDay.get(b.key);
    return {
      x: b.label,
      score: r?.score ?? null,
      hrv: r?.hrv_avg ?? null,
      rhr: r?.resting_hr ?? null,
    };
  });

  const latest = rows[rows.length - 1];
  return {
    points,
    series: [
      { key: "score", label: "Readiness" },
      { key: "hrv", label: "HRV (ms)" },
      { key: "rhr", label: "Resting HR" },
    ],
    summary: { latestScore: latest?.score ?? null },
  };
}

// Body weight (+ body fat) over time. Measurements are sparse, so we plot the
// actual measurement points rather than daily buckets.
export async function weightTrend(
  supabase: SupabaseClient,
  days = 90,
): Promise<TrendResult> {
  const { data } = await supabase
    .schema("wellness")
    .from("body_composition")
    .select("measured_at, weight_lbs, body_fat_pct")
    .gte("measured_at", isoDaysAgo(days))
    .order("measured_at", { ascending: true });
  const rows = (data ?? []).filter((r) => r.weight_lbs != null);
  if (rows.length === 0) return { points: [], series: [] };

  const points = rows.map((r) => ({
    x: format(new Date(r.measured_at), "MMM d"),
    weight: r.weight_lbs as number,
    bodyfat: r.body_fat_pct ?? null,
  }));

  const first = rows[0].weight_lbs as number;
  const last = rows[rows.length - 1].weight_lbs as number;
  return {
    points,
    series: [{ key: "weight", label: "Weight (lb)" }],
    summary: { delta: Math.round((last - first) * 10) / 10, latest: last },
  };
}

// Mood / energy / stress daily averages over `days` days.
export async function moodTrend(
  supabase: SupabaseClient,
  days = 30,
): Promise<TrendResult> {
  const { data } = await supabase
    .schema("wellness")
    .from("mood_entries")
    .select("occurred_at, mood, energy, stress")
    .gte("occurred_at", isoDaysAgo(days))
    .order("occurred_at", { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return { points: [], series: [] };

  const byDay = new Map<string, { mood: number[]; energy: number[]; stress: number[] }>();
  for (const r of rows) {
    const k = dayKey(new Date(r.occurred_at));
    const s = byDay.get(k) ?? { mood: [], energy: [], stress: [] };
    if (r.mood != null) s.mood.push(r.mood);
    if (r.energy != null) s.energy.push(r.energy);
    if (r.stress != null) s.stress.push(r.stress);
    byDay.set(k, s);
  }

  const points = lastNDays(days).map((b) => {
    const s = byDay.get(b.key);
    return {
      x: b.label,
      mood: s ? avg1(s.mood) : null,
      energy: s ? avg1(s.energy) : null,
      stress: s ? avg1(s.stress) : null,
    };
  });

  return {
    points,
    series: [
      { key: "mood", label: "Mood" },
      { key: "energy", label: "Energy" },
      { key: "stress", label: "Stress" },
    ],
  };
}

// Weekly lifting volume (sum of weight*reps across all sets) over `weeks` weeks.
export async function trainingLoadTrend(
  supabase: SupabaseClient,
  weeks = 12,
): Promise<TrendResult> {
  const { data } = await supabase
    .schema("wellness")
    .from("workouts")
    .select("started_at, lifting_sets(weight_lbs, reps)")
    .eq("kind", "lifting")
    .gte("started_at", isoDaysAgo(weeks * 7))
    .order("started_at", { ascending: true });
  const rows = data ?? [];
  if (rows.length === 0) return { points: [], series: [] };

  const byWeek = new Map<string, number>();
  for (const w of rows) {
    const k = weekKey(new Date(w.started_at));
    const sets = (w.lifting_sets ?? []) as {
      weight_lbs: number | null;
      reps: number | null;
    }[];
    const vol = sets.reduce(
      (a, s) => a + (s.weight_lbs ?? 0) * (s.reps ?? 0),
      0,
    );
    byWeek.set(k, (byWeek.get(k) ?? 0) + vol);
  }

  const points = lastNWeeks(weeks).map((b) => ({
    x: b.label,
    volume: Math.round(byWeek.get(b.key) ?? 0),
  }));

  return { points, series: [{ key: "volume", label: "Volume (lb)" }] };
}
