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
// so optional fields stay optional in Zod.
//
// IMPORTANT: `.optional()` must live INSIDE the preprocess's inner schema,
// not outside. In Zod 4 a `.optional()` on the outer chain only short-
// circuits when the *raw input* is undefined; for an empty string the
// preprocess still runs first, returns undefined, then the inner schema
// (z.string(), z.coerce.number(), etc.) sees undefined and rejects it.
// Putting `.optional()` inside makes the inner schema accept undefined
// directly. (Earlier draft had `.optional()` on the outside; that made
// every "optional" field act as required.)

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

const optionalInt = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number().int().optional(),
);

const optionalNumber = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number().optional(),
);

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.date().optional(),
);

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
    z.enum(mealTypes).optional(),
  ),
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


// ============================================================================
// BODY COMPOSITION
// ============================================================================

export const bodyCompositionSchema = z.object({
  measured_at: z.coerce.date(),
  // Every measurement nullable so a quick "weight only" check-in is a valid
  // row.
  weight_lbs: optionalNumber,
  body_fat_pct: optionalNumber.refine(
    (v) => v === undefined || (v >= 0 && v <= 100),
    "Body fat % must be 0-100",
  ),
  skeletal_muscle_lbs: optionalNumber,
  waist_in: optionalNumber,
  chest_in: optionalNumber,
  arm_in: optionalNumber,
  thigh_in: optionalNumber,
  notes: optionalText,
});

export type BodyCompositionInput = z.infer<typeof bodyCompositionSchema>;


// ============================================================================
// CYCLE
// ============================================================================

export const cyclePhases = ["menstrual", "follicular", "ovulation", "luteal"] as const;
export const cycleFlows = ["none", "light", "medium", "heavy"] as const;

// occurred_at is a calendar date (not a timestamptz). The form uses
// <input type="date"> which posts "YYYY-MM-DD".
export const cycleEntrySchema = z.object({
  occurred_at: z.coerce.date(),
  phase: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(cyclePhases).optional(),
  ),
  flow: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.enum(cycleFlows).optional(),
  ),
  // Symptoms come from a TagInput like mood.tags.
  symptoms: z.preprocess(
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
  notes: optionalText,
});

export type CycleEntryInput = z.infer<typeof cycleEntrySchema>;


// ============================================================================
// MEDICATIONS - registry (no event) + logs (event per dose)
// ============================================================================

export const medicationSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  dosage: optionalText,
  frequency: optionalText,
  started_on: optionalDate,
  ended_on: optionalDate,
  prescribing_doctor: optionalText,
  purpose: optionalText,
  notes: optionalText,
}).refine(
  (v) => !v.ended_on || !v.started_on || v.ended_on >= v.started_on,
  { message: "End date must be after start date", path: ["ended_on"] },
);

export type MedicationInput = z.infer<typeof medicationSchema>;

export const medicationLogSchema = z.object({
  medication_id: z.string().uuid("Pick a medication"),
  taken_at: z.coerce.date(),
  dose_taken: optionalText,
  skipped: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean(),
  ),
  notes: optionalText,
});

export type MedicationLogInput = z.infer<typeof medicationLogSchema>;


// ============================================================================
// BLOODWORK - panel header + per-marker results
// ============================================================================

export const bloodworkPanelSchema = z.object({
  drawn_at: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.date({ message: "Pick a valid draw date" }),
  ),
  lab_name: optionalText,
  ordering_provider: optionalText,
  panel_type: optionalText,           // free text: "annual", "thyroid", etc.
  notes: optionalText,
});

export type BloodworkPanelInput = z.infer<typeof bloodworkPanelSchema>;

export const bloodworkResultFlags = ["high", "low", "normal", "critical"] as const;

// One row in the dynamic results list. At least one of value / value_text
// must be populated (matches the CHECK constraint on the DB column).
export const bloodworkResultSchema = z
  .object({
    marker_name: z.string().trim().min(1, "Marker name is required"),
    value: optionalNumber,
    value_text: optionalText,
    unit: optionalText,
    reference_low: optionalNumber,
    reference_high: optionalNumber,
    flag: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.enum(bloodworkResultFlags).optional(),
    ),
    notes: optionalText,
  })
  .refine(
    (r) => r.value != null || (r.value_text != null && r.value_text.length > 0),
    { message: "Enter a numeric value or a text value", path: ["value"] },
  );

export type BloodworkResultInput = z.infer<typeof bloodworkResultSchema>;

// Pre-populated quick-add markers shown as buttons on the form. Each click
// drops a new result row with the name pre-filled. Order is intentional - the
// most commonly-tracked-first.
export const quickAddMarkers: { name: string; unit: string }[] = [
  { name: "TSH",                  unit: "uIU/mL" },
  { name: "LDL",                  unit: "mg/dL" },
  { name: "HDL",                  unit: "mg/dL" },
  { name: "Triglycerides",        unit: "mg/dL" },
  { name: "Testosterone Total",   unit: "ng/dL" },
  { name: "Vitamin D, 25-OH",     unit: "ng/mL" },
  { name: "Hemoglobin A1C",       unit: "%" },
  { name: "Glucose",              unit: "mg/dL" },
  { name: "WBC",                  unit: "10^3/uL" },
  { name: "RBC",                  unit: "10^6/uL" },
  { name: "Hemoglobin",           unit: "g/dL" },
  { name: "Hematocrit",           unit: "%" },
  { name: "Platelets",            unit: "10^3/uL" },
];
