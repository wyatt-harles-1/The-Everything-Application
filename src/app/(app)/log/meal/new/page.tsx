// Log a new meal. The MealForm itself is reused for editing in /log/meal/[id].

import Link from "next/link";

import { MealForm } from "../MealForm";
import { createMeal } from "../actions";

export default function NewMealPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/log"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to log
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Log a meal
        </h1>
      </header>

      <MealForm action={createMeal} submitLabel="Save meal" />
    </div>
  );
}
