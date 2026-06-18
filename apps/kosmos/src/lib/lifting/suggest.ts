// Pure suggestion logic for the lifting module's auto-schedule. Given
// the user's lifting_rules row, the active mesocycle (if any), and a
// target week, returns proposed scheduled-event rows.
//
// Why TS and not a Postgres function (as the original roadmap drafted)?
// Date arithmetic + calendar pattern generation is markedly easier to
// write + test in TS, and the future master agent (Phase 4e) can invoke
// this just as easily as it could call an RPC - both surfaces sit
// behind the same tool-shaped Server Action interface (invariant #7).

import { startOfISOWeek } from "@/lib/scheduler/streak";

export type LiftingRules = {
  frequency_per_week: number;
  preferred_days: number[] | null;
  default_time: string; // "HH:MM"
  skip_deload: boolean;
};

export type ActiveMesoForSuggest = {
  id: string;
  name: string;
  started_at: string; // YYYY-MM-DD
  planned_weeks: number;
  deload_week_number: number | null;
} | null;

export type LiftingSuggestion = {
  // What day of the week (1=Mon...7=Sun) the suggestion is for.
  weekday: number;
  // Absolute datetime in ISO. Anchored to the target week's Monday +
  // (weekday - 1) days, at the rules.default_time.
  scheduled_for: string;
  title: string;
};

// Even-spaced fallback patterns used when rules.preferred_days is null.
// Hand-picked to match how most lifters distribute volume - this isn't
// load-bearing; the user can always override via preferred_days.
const EVEN_SPACED: Record<number, number[]> = {
  0: [],
  1: [1],                  // Mon
  2: [2, 5],               // Tue, Fri
  3: [1, 3, 5],            // Mon, Wed, Fri
  4: [1, 2, 4, 5],         // Mon, Tue, Thu, Fri
  5: [1, 2, 3, 5, 6],      // Mon, Tue, Wed, Fri, Sat
  6: [1, 2, 3, 4, 6, 7],   // Mon, Tue, Wed, Thu, Sat, Sun
  7: [1, 2, 3, 4, 5, 6, 7],
};

function computeMesoCurrentWeek(
  meso: NonNullable<ActiveMesoForSuggest>,
  weekStart: Date,
): number {
  const mesoStart = new Date(meso.started_at + "T00:00:00");
  const mesoStartOfWeek = startOfISOWeek(mesoStart);
  const diffDays = Math.floor(
    (weekStart.getTime() - mesoStartOfWeek.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  return Math.min(meso.planned_weeks, Math.max(1, Math.floor(diffDays / 7) + 1));
}

export function suggestLiftingForWeek(args: {
  rules: LiftingRules;
  meso: ActiveMesoForSuggest;
  weekStart: Date;                // Monday 00:00 of the target week
  existingWorkoutTimes: Date[];   // already-scheduled workouts in that week
}): LiftingSuggestion[] {
  const { rules, meso, weekStart, existingWorkoutTimes } = args;

  // 0-frequency = user wants no auto-suggestions.
  if (rules.frequency_per_week <= 0) return [];

  // Deload-week skip: if user opted out of deload weeks AND the active
  // meso says this is the deload week, emit nothing.
  if (meso && rules.skip_deload && meso.deload_week_number != null) {
    const week = computeMesoCurrentWeek(meso, weekStart);
    if (week === meso.deload_week_number) return [];
  }

  const targetDays =
    rules.preferred_days && rules.preferred_days.length > 0
      ? [...new Set(rules.preferred_days)].sort((a, b) => a - b)
      : EVEN_SPACED[rules.frequency_per_week] ?? [];

  // De-duplicate: if the user already has a workout scheduled within ±3h
  // of a proposed slot, skip suggesting that slot. Prevents the
  // suggestions panel from looping after the user accepts.
  const occupiedDayKeys = new Set(
    existingWorkoutTimes.map((d) => {
      const ws = startOfISOWeek(d);
      const dayIdx = Math.floor(
        (d.getTime() - ws.getTime()) / (1000 * 60 * 60 * 24),
      );
      return dayIdx; // 0=Mon ... 6=Sun
    }),
  );

  const [hStr, mStr] = rules.default_time.split(":");
  const hh = Number(hStr);
  const mm = Number(mStr);

  const titleBase = meso
    ? `${meso.name} · Wk ${computeMesoCurrentWeek(meso, weekStart)}`
    : "Lifting session";

  const out: LiftingSuggestion[] = [];
  for (const wd of targetDays) {
    // weekStart is Monday; weekday 1 => offset 0, weekday 7 => offset 6.
    const offsetDays = wd - 1;
    if (occupiedDayKeys.has(offsetDays)) continue;
    const when = new Date(weekStart);
    when.setDate(when.getDate() + offsetDays);
    when.setHours(hh, mm, 0, 0);
    out.push({
      weekday: wd,
      scheduled_for: when.toISOString(),
      title: titleBase,
    });
  }
  return out;
}
