// Shared card used on /habits and (potentially) the dashboard. Renders a
// habit's this-week progress bar + streak label. Read-only - the parent
// link is on the wrapping anchor.

import Link from "next/link";

import type { HabitProgress } from "@/lib/scheduler/streak";

export type HabitForCard = {
  id: string;
  name: string;
  domain: string;
  event_type: string | null;
};

export function HabitCard({
  habit,
  progress,
}: {
  habit: HabitForCard;
  progress: HabitProgress;
}) {
  const pct = Math.min(
    100,
    Math.round((progress.thisWeekCount / progress.target) * 100),
  );
  return (
    <Link
      href={`/habits/${habit.id}`}
      className="block rounded-[var(--radius-card)] border border-border bg-surface p-3 transition-colors hover:bg-hover"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-text">{habit.name}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {progress.thisWeekCount}/{progress.target} this wk
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hover">
        <div
          className={`h-full ${
            progress.thisWeekMet
              ? "bg-success"
              : progress.isStreakAlive
                ? "bg-muted"
                : "bg-warn"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted">
        {habit.domain}
        {habit.event_type ? ` · ${habit.event_type}` : ""} ·{" "}
        {progress.streakWeeks > 0
          ? `🔥 ${progress.streakWeeks}-week streak`
          : progress.isStreakAlive
            ? "streak alive"
            : "no streak"}
      </p>
    </Link>
  );
}
