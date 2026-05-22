// Single source of truth for wellness-domain form validation. Used both
// client-side (where useful) and inside Server Actions before any DB writes.
//
// Convention: every schema takes the raw FormData shape (strings everywhere)
// and uses `z.coerce` to turn it into the proper type. Empty strings become
// undefined via `emptyAsUndefined` so optional fields don't blow up when the
// input is left blank.
//
// Wave 1 covers: workouts (+ lifting / cardio / mobility children), meals,
// sleep, mood. Wave 2 + 3 schemas live further down the file when they're
// added.

import { z } from "zod";

// ----- shared helpers --------------------------------------------------------

// FormData stringifies every value. An empty string ("") is the FormData
// equivalent of "user left this blank" - which we want to treat as undefined
// so optional fields stay optional in Zod. Each `optional*` helper below
// applies that same preprocess before its target type.

const optionalText = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string(),
  )
  .optional();

const optionalInt = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().int(),
  )
  .optional();

const optionalNumber = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number(),
  )
  .optional();

const optionalDate = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.date(),
  )
  .optional();

// ============================================================================
// WORKOUTS - parent + per-kind children
// ============================================================================

export const workoutKinds = [
  "lifting",
  "running",
  "cycling",
  "swimming",
  "mobility",
  "walk",
  "sport",
  "other",
] as const;

export const workoutBaseSchema = z.object({
  started_at: z.coerce.date(),
  ended_at: optionalDate,
  kind: z.enum(workoutKinds),
  title: optionalText,
  // Perceived effort uses a 1-10 RatingScale. Optional because not every kind
  // benefits from it (a 5-minute mobility flow probably doesn't).
  perceived_effort: optionalInt.refine(
    (v) => v === undefined || (v >= 1 && v <= 10),
    "Perceived effort must be 1-10",
  ),
  notes: optionalText,
  location: optionalText,
}).refine(
  (v) => !v.ended_at || v.ended_at >= v.started_at,
  { message: "End time must be after start time", path: ["ended_at"] },
);

// One row inside the sets array. Lifting forms collect any number of these
// and post them alongside the parent workout fields.
export const liftingSetSchema = z.object({
  exercise_name: z.string().trim().min(1, "Exercise name is required"),
  set_number: z.coerce.number().int().min(1),
  reps: optionalInt,
  weight_lbs: optionalNumber,
  rpe: optionalNumber.refine(
    (v) => v === undefined || (v >= 1 && v <= 10),
    "RPE must be 1-10",
  ),
  is_warmup: z.preprocess(
    // Checkboxes either send "on" or omit the field entirely.
    (v) => v === "on" || v === true || v === "true",
    z.boolean(),
  ),
  notes: optionalText,
});

export const cardioSessionSchema = z.object({
  distance_meters: optionalNumber,
  duration_seconds: optionalInt,
  avg_heart_rate: optionalInt,
  max_heart_rate: optionalInt,
  elevation_gain_meters: optionalNumber,
  route_notes: optionalText,
});

export const mobilityEntrySchema = z.object({
  focus_area: optionalText,
  protocol: optionalText,
  duration_minutes: optionalInt,
});


// ============================================================================
// MEALS
// ============================================================================

export const mealTypes = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "other",
] as const;

export const mealSchema = z.object({
  occurred_at: z.coerce.date(),
  meal_type: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(mealTypes),
  ).optional(),
  description: z.string().trim().min(1, "Description is required"),
  calories: optionalInt,
  protein_g: optionalNumber,
  carbs_g: optionalNumber,
  fat_g: optionalNumber,
  fiber_g: optionalNumber,
  notes: optionalText,
});

export type MealInput = z.infer<typeof mealSchema>;


// ============================================================================
// SLEEP
// ============================================================================

export const sleepSchema = z.object({
  start_at: z.coerce.date(),
  end_at: z.coerce.date(),
  quality: optionalInt.refine(
    (v) => v === undefined || (v >= 1 && v <= 10),
    "Quality must be 1-10",
  ),
  interruptions: optionalInt,
  dreams_notes: optionalText,
  notes: optionalText,
}).refine(
  (v) => v.end_at > v.start_at,
  { message: "Wake time must be after sleep time", path: ["end_at"] },
);

export type SleepInput = z.infer<typeof sleepSchema>;


// ============================================================================
// MOOD
// ============================================================================

export const moodSchema = z.object({
  occurred_at: z.coerce.date(),
  mood: z.coerce.number().int().min(1).max(10),
  energy: optionalInt.refine(
    (v) => v === undefined || (v >= 1 && v <= 10),
    "Energy must be 1-10",
  ),
  stress: optionalInt.refine(
    (v) => v === undefined || (v >= 1 && v <= 10),
    "Stress must be 1-10",
  ),
  anxiety: optionalInt.refine(
    (v) => v === undefined || (v >= 1 && v <= 10),
    "Anxiety must be 1-10",
  ),
  notes: optionalText,
  // TagInput posts a comma-separated string in one hidden field. Split it
  // here so the rest of the pipeline sees a clean string[].
  tags: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const arr = v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      return arr.length ? arr : undefined;
    },
    z.array(z.string()).optional(),
  ),
});

export type MoodInput = z.infer<typeof moodSchema>;
