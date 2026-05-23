// Curated starter set of common lifting exercises. The /lifting/exercises
// empty-state surfaces a "Seed starter exercises" button that bulk-inserts
// these for the signed-in user. Order is rough order of importance (compounds
// first, then per-muscle accessories) so when the page lists them it scans
// well.

export type StarterExercise = {
  name: string;
  muscle_group: string;
  equipment: string;
};

export const starterExercises: StarterExercise[] = [
  // ----- compounds ---------------------------------------------------------
  { name: "Back Squat",            muscle_group: "quads",      equipment: "barbell" },
  { name: "Front Squat",           muscle_group: "quads",      equipment: "barbell" },
  { name: "Bench Press",           muscle_group: "chest",      equipment: "barbell" },
  { name: "Incline Bench Press",   muscle_group: "chest",      equipment: "barbell" },
  { name: "Deadlift",              muscle_group: "back",       equipment: "barbell" },
  { name: "Romanian Deadlift",     muscle_group: "hamstrings", equipment: "barbell" },
  { name: "Overhead Press",        muscle_group: "shoulders",  equipment: "barbell" },
  { name: "Push Press",            muscle_group: "shoulders",  equipment: "barbell" },
  { name: "Barbell Row",           muscle_group: "back",       equipment: "barbell" },
  { name: "Pull-up",               muscle_group: "back",       equipment: "bodyweight" },
  { name: "Chin-up",               muscle_group: "back",       equipment: "bodyweight" },
  { name: "Dip",                   muscle_group: "chest",      equipment: "bodyweight" },

  // ----- back / pull -------------------------------------------------------
  { name: "Lat Pulldown",          muscle_group: "back",       equipment: "cable" },
  { name: "Seated Cable Row",      muscle_group: "back",       equipment: "cable" },
  { name: "Face Pull",             muscle_group: "shoulders",  equipment: "cable" },

  // ----- chest -------------------------------------------------------------
  { name: "Dumbbell Bench Press",  muscle_group: "chest",      equipment: "dumbbell" },
  { name: "Cable Fly",             muscle_group: "chest",      equipment: "cable" },

  // ----- shoulders ---------------------------------------------------------
  { name: "Lateral Raise",         muscle_group: "shoulders",  equipment: "dumbbell" },
  { name: "Front Raise",           muscle_group: "shoulders",  equipment: "dumbbell" },
  { name: "Rear Delt Fly",         muscle_group: "shoulders",  equipment: "dumbbell" },

  // ----- arms --------------------------------------------------------------
  { name: "Barbell Curl",          muscle_group: "biceps",     equipment: "barbell" },
  { name: "Hammer Curl",           muscle_group: "biceps",     equipment: "dumbbell" },
  { name: "Tricep Pushdown",       muscle_group: "triceps",    equipment: "cable" },
  { name: "Skullcrusher",          muscle_group: "triceps",    equipment: "barbell" },

  // ----- legs --------------------------------------------------------------
  { name: "Leg Press",             muscle_group: "quads",      equipment: "machine" },
  { name: "Leg Curl",              muscle_group: "hamstrings", equipment: "machine" },
  { name: "Leg Extension",         muscle_group: "quads",      equipment: "machine" },
  { name: "Bulgarian Split Squat", muscle_group: "quads",      equipment: "dumbbell" },
  { name: "Calf Raise",            muscle_group: "calves",     equipment: "machine" },
  { name: "Hip Thrust",            muscle_group: "glutes",     equipment: "barbell" },

  // ----- core --------------------------------------------------------------
  { name: "Plank",                 muscle_group: "abs",        equipment: "bodyweight" },
  { name: "Hanging Leg Raise",     muscle_group: "abs",        equipment: "bodyweight" },
  { name: "Cable Crunch",          muscle_group: "abs",        equipment: "cable" },
];

// Muscle-group + equipment enum values for form selects. Keep in sync with
// the CHECK constraints in the wellness.exercises migration.
export const muscleGroups = [
  "chest", "back", "shoulders",
  "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves",
  "abs", "obliques",
  "full_body", "other",
] as const;

export const equipmentTypes = [
  "barbell", "dumbbell", "cable", "machine",
  "bodyweight", "kettlebell", "band",
  "other",
] as const;
