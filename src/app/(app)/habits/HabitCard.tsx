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
      className="block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{habit.name}</span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {progress.thisWeekCount}/{progress.target} this wk
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
      <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
