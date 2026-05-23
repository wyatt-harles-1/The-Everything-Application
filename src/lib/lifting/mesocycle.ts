// Pure helpers for mesocycle math. Shared between the server pages
// (computing "week N of X" + remaining days) and the action layer
// (auto-tagging new workouts with the active meso).

export type MesocycleRow = {
  id: string;
  name: string;
  started_at: string;            // ISO date "YYYY-MM-DD"
  planned_weeks: number;
  deload_week_number: number | null;
  ended_at: string | null;       // ISO date when finished
};

export type MesoProgress = {
  // 1-indexed week the user is currently in. Clamps to [1, planned_weeks]
  // even if the calendar's run past the planned end (the meso is "live"
  // until the user explicitly finishes it).
  currentWeek: number;
  // Day-of-week within the meso (1-indexed). Useful for "Day 23/35" style.
  dayInBlock: number;
  // Total days the block plans for (planned_weeks * 7).
  totalDays: number;
  // Days remaining if the meso runs the planned duration. Can be negative
  // when the user is past the planned end without having closed the block.
  daysRemaining: number;
  // True if the user is currently in the deload week.
  isDeloadWeek: boolean;
};

export function computeMesoProgress(
  meso: MesocycleRow,
  now: Date = new Date(),
): MesoProgress {
  const start = new Date(meso.started_at + "T00:00:00");
  // Day-of-block: 1-indexed inclusive.
  const dayInBlock = Math.max(
    1,
    Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const totalDays = meso.planned_weeks * 7;
  const currentWeek = Math.min(
    meso.planned_weeks,
    Math.max(1, Math.ceil(dayInBlock / 7)),
  );
  const daysRemaining = totalDays - dayInBlock + 1;
  const isDeloadWeek =
    meso.deload_week_number != null && currentWeek === meso.deload_week_number;
  return {
    currentWeek,
    dayInBlock,
    totalDays,
    daysRemaining,
    isDeloadWeek,
  };
}

// "Week 3 of 5 · deload" type label, suitable for badges + headers.
export function formatMesoStatusShort(p: MesoProgress, totalWeeks: number): string {
  const base = `Week ${p.currentWeek} of ${totalWeeks}`;
  return p.isDeloadWeek ? `${base} · deload` : base;
}
