import Link from "next/link";

import { GoalForm } from "../GoalForm";
import { createGoal } from "../actions";

export default function NewGoalPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/goals"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Goals
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          New goal
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Goals can be quantitative or qualitative. The target fields are
          optional - leave them blank for a directional goal.
        </p>
      </header>

      <GoalForm action={createGoal} submitLabel="Create goal" />
    </div>
  );
}
