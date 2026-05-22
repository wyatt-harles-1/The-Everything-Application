import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { toDateTimeLocalUTC } from "@/lib/format";

import { WorkoutForm, type LiftingSetDraft, type WorkoutFormDefaults } from "../WorkoutForm";
import { updateWorkout, deleteWorkout } from "../actions";

const cardioKinds = new Set(["running", "cycling", "swimming", "walk"]);

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id } = await params;
  const { flash } = await searchParams;

  const supabase = await createClient();

  // Parent workout
  const { data: workout, error } = await supabase
    .schema("wellness")
    .from("workouts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !workout) notFound();

  // Children - only load the one relevant to kind
  const defaults: WorkoutFormDefaults = {
    started_at: toDateTimeLocalUTC(workout.started_at),
    ended_at: workout.ended_at ? toDateTimeLocalUTC(workout.ended_at) : undefined,
    kind: workout.kind,
    title: workout.title ?? "",
    perceived_effort: workout.perceived_effort,
    notes: workout.notes ?? "",
    location: workout.location ?? "",
  };

  if (workout.kind === "lifting") {
    const { data: sets } = await supabase
      .schema("wellness")
      .from("lifting_sets")
      .select("*")
      .eq("workout_id", id)
      .order("set_number", { ascending: true });
    defaults.lifting_sets = (sets ?? []).map(
      (s): LiftingSetDraft => ({
        exercise_name: s.exercise_name,
        set_number: s.set_number,
        reps: s.reps?.toString() ?? "",
        weight_lbs: s.weight_lbs?.toString() ?? "",
        rpe: s.rpe?.toString() ?? "",
        is_warmup: s.is_warmup,
        notes: s.notes ?? "",
      }),
    );
  } else if (cardioKinds.has(workout.kind)) {
    const { data: cardio } = await supabase
      .schema("wellness")
      .from("cardio_sessions")
      .select("*")
      .eq("workout_id", id)
      .maybeSingle();
    if (cardio) {
      defaults.cardio = {
        distance_meters: cardio.distance_meters,
        duration_seconds: cardio.duration_seconds,
        avg_heart_rate: cardio.avg_heart_rate,
        max_heart_rate: cardio.max_heart_rate,
        elevation_gain_meters: cardio.elevation_gain_meters,
        route_notes: cardio.route_notes ?? "",
      };
    }
  } else if (workout.kind === "mobility") {
    const { data: mob } = await supabase
      .schema("wellness")
      .from("mobility_entries")
      .select("*")
      .eq("workout_id", id)
      .maybeSingle();
    if (mob) {
      defaults.mobility = {
        focus_area: mob.focus_area ?? "",
        protocol: mob.protocol ?? "",
        duration_minutes: mob.duration_minutes,
      };
    }
  }

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
          Edit workout
        </h1>
      </header>

      {flash === "created" ? (
        <FlashBanner>Workout logged ✓</FlashBanner>
      ) : flash === "updated" ? (
        <FlashBanner>Workout updated ✓</FlashBanner>
      ) : null}

      <WorkoutForm
        action={updateWorkout.bind(null, id)}
        submitLabel="Update workout"
        defaults={defaults}
      />

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <form action={deleteWorkout.bind(null, id)}>
        <button
          type="submit"
          className="text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete this workout
        </button>
      </form>
    </div>
  );
}

function FlashBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}
