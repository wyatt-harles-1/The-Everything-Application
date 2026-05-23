import Link from "next/link";

import { HabitForm } from "../HabitForm";
import { createHabit } from "../actions";

export default function NewHabitPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/habits"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Habits
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          New habit
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Per-week target. Streak counts from the timeline automatically -
          you don&apos;t check in here, just log normally.
        </p>
      </header>

      <HabitForm action={createHabit} submitLabel="Create habit" />
    </div>
  );
}
