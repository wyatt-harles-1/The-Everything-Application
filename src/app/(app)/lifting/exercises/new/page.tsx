import Link from "next/link";

import { ExerciseForm } from "../../ExerciseForm";
import { createExercise } from "../../actions";

export default function NewExercisePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/lifting/exercises"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Exercises
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Add exercise
        </h1>
      </header>

      <ExerciseForm action={createExercise} submitLabel="Save exercise" />
    </div>
  );
}
