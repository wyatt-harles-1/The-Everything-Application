-- =============================================================================
-- wellness.exercises - per-user exercise library.
--
-- An exercise is a named movement (e.g. "Back Squat") with metadata that's
-- the same across all sessions: which muscle group it works, what equipment
-- it needs, optional instructions / cues / video link. A row here is
-- referenced from wellness.lifting_sets so that "what did I bench last week"
-- queries don't have to fuzzy-match free-text exercise_name strings.
--
-- Scope is per-user via RLS. There's no global library; users build their
-- own. The /lifting/exercises page has a "seed starter exercises" action
-- that bulk-inserts ~30 common movements with one click.
-- =============================================================================

CREATE TABLE wellness.exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id     uuid NOT NULL REFERENCES shared.sources(id),

  name          text NOT NULL,

  -- Free-text + CHECK so adding a new muscle group is a single ALTER (not a
  -- new TYPE). Same pattern as workouts.kind / meals.meal_type.
  muscle_group  text
                  CHECK (muscle_group IS NULL OR muscle_group IN (
                    'chest', 'back', 'shoulders',
                    'biceps', 'triceps', 'forearms',
                    'quads', 'hamstrings', 'glutes', 'calves',
                    'abs', 'obliques',
                    'full_body', 'other'
                  )),

  equipment     text
                  CHECK (equipment IS NULL OR equipment IN (
                    'barbell', 'dumbbell', 'cable', 'machine',
                    'bodyweight', 'kettlebell', 'band',
                    'other'
                  )),

  instructions  text,                  -- optional cues / form notes
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- One exercise per (user, name). Prevents accidentally duplicating "Bench
  -- Press" vs "bench press"; the application UI normalizes casing on input.
  CONSTRAINT exercises_user_name_unique UNIQUE (user_id, name)
);

CREATE TRIGGER exercises_set_updated_at
  BEFORE UPDATE ON wellness.exercises
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

-- Common access patterns: list a user's active exercises alphabetically;
-- look up by name when matching free-text input.
CREATE INDEX exercises_user_active_idx
  ON wellness.exercises (user_id, name)
  WHERE is_active = true;

CREATE INDEX exercises_user_muscle_idx
  ON wellness.exercises (user_id, muscle_group)
  WHERE is_active = true;

ALTER TABLE wellness.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises: users access own rows"
  ON wellness.exercises FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
