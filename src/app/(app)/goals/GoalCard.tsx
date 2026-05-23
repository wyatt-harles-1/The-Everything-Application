// Compact card used in lists. Highlights priority + target date countdown.

import Link from "next/link";

import { formatDate } from "@/lib/format";

export type GoalForCard = {
  id: string;
  title: string;
  domain: string;
  category: string | null;
  target_metric: string | null;
  target_value: number | null;
  target_date: string | null;
  priority: number;
  status: "active" | "paused" | "achieved" | "abandoned";
};

function dayDiff(targetIso: string): number {
  const target = new Date(targetIso + "T23:59:59");
  const now = new Date();
  return Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function GoalCard({ goal }: { goal: GoalForCard }) {
  const days = goal.target_date ? dayDiff(goal.target_date) : null;
  const overdue =
    goal.status === "active" && days != null && days < 0;

  const targetSummary = [
    goal.target_metric,
    goal.target_value != null ? String(goal.target_value) : null,
  ]
    .filter(Boolean)
    .join(" → ");

  return (
    <Link
      href={`/goals/${goal.id}`}
      className={`block rounded-md border p-3 transition-colors ${
        overdue
          ? "border-amber-300 bg-amber-50/40 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">
          {goal.title}
          <span
            className="ml-1.5 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            aria-label={`priority ${goal.priority}`}
          >
            P{goal.priority}
          </span>
        </span>
        {goal.target_date ? (
          <span
            className={`shrink-0 text-xs tabular-nums ${
              overdue
                ? "text-amber-700 dark:text-amber-300"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {days != null && days >= 0
              ? `${days}d left`
              : `overdue ${formatDate(goal.target_date)}`}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {goal.domain}
        {goal.category ? ` · ${goal.category}` : ""}
        {targetSummary ? ` · ${targetSummary}` : ""}
      </p>
    </Link>
  );
}
