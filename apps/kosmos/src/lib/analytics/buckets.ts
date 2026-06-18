// Time-bucketing helpers built on date-fns. These pre-seed every bucket in the
// window (so charts render a continuous axis with gaps as null, not missing
// points) and produce stable "yyyy-MM-dd" keys to join data rows against.
//
// Note: buckets use the server's local day boundaries (consistent with the rest
// of the app, e.g. coach.ts isoToday). TZ-aware bucketing is deferred tech debt.

import {
  eachDayOfInterval,
  eachWeekOfInterval,
  startOfDay,
  startOfWeek,
  subDays,
  format,
} from "date-fns";

const WEEK_OPTS = { weekStartsOn: 1 as const }; // ISO weeks (Mon)

export function dayKey(d: Date): string {
  return format(startOfDay(d), "yyyy-MM-dd");
}

export function weekKey(d: Date): string {
  return format(startOfWeek(d, WEEK_OPTS), "yyyy-MM-dd");
}

// Ordered day buckets covering the last `days` days, inclusive of today.
export function lastNDays(days: number): { key: string; label: string }[] {
  const end = startOfDay(new Date());
  const start = subDays(end, days - 1);
  return eachDayOfInterval({ start, end }).map((d) => ({
    key: format(d, "yyyy-MM-dd"),
    label: format(d, "MMM d"),
  }));
}

// Ordered week buckets (Mon-anchored) covering the last `weeks` weeks.
export function lastNWeeks(weeks: number): { key: string; label: string }[] {
  const end = startOfWeek(new Date(), WEEK_OPTS);
  const start = startOfWeek(subDays(end, (weeks - 1) * 7), WEEK_OPTS);
  return eachWeekOfInterval({ start, end }, WEEK_OPTS).map((d) => ({
    key: format(d, "yyyy-MM-dd"),
    label: format(d, "MMM d"),
  }));
}

// Round to one decimal, or null for an empty set (used for daily averages).
export function avg1(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}
