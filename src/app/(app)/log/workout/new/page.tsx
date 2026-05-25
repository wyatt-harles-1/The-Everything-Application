import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { WorkoutForm } from "../WorkoutForm";
import { createWorkout } from "../actions";

export default async function NewWorkoutPage() {
  // Pull the user's exercise library so the lifting sub-form can autocomplete
  // exercise names. The actions.ts side resolves the typed name back to an
  // exercise_id when it matches.
  const supabase = await createClient();
  const [{ data: exercises }, { data: shoes }] = await Promise.all([
    supabase
      .schema("wellness")
      .from("exercises")
      .select("name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .schema("wellness")
      .from("shoes")
      .select("id, name")
      .is("retired_at", null)
      .order("started_at", { ascending: false }),
  ]);
  const exerciseNames = (exercises ?? []).map((e) => e.name);
  const activeShoes = (shoes ?? []) as { id: string; name: string }[];

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
          Log a workout
        </h1>
      </header>

      <WorkoutForm
        action={createWorkout}
        submitLabel="Save workout"
        exerciseNames={exerciseNames}
        activeShoes={activeShoes}
      />
    </div>
  );
}
