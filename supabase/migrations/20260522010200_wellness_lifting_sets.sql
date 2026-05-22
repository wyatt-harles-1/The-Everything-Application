-- =============================================================================
-- wellness.lifting_sets - one row per set within a lifting workout.
-- No source_id on the row itself: the parent workout carries that, and the
-- set is just detail. No event row either - the workout is the event.
-- =============================================================================

CREATE TABLE wellness.lifting_sets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id     uuid NOT NULL REFERENCES shared.sources(id),
  workout_id    uuid NOT NULL REFERENCES wellness.workouts(id) ON DELETE CASCADE,

  exercise_name text NOT NULL,
  set_number    integer NOT NULL CHECK (set_number >= 1),

  reps          integer       CHECK (reps IS NULL OR reps >= 0),
  weight_lbs    numeric(7,2)  CHECK (weight_lbs IS NULL OR weight_lbs >= 0),
  rpe           numeric(3,1)  CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),

  is_warmup     boolean NOT NULL DEFAULT false,
  notes         text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER lifting_sets_set_updated_at
  BEFORE UPDATE ON wellness.lifting_sets
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

-- Common access pattern: pull all sets for one workout, ordered by set_number.
CREATE INDEX lifting_sets_workout_idx
  ON wellness.lifting_sets (workout_id, set_number);

-- Secondary access pattern: PRs / exercise history across workouts.
CREATE INDEX lifting_sets_user_exercise_idx
  ON wellness.lifting_sets (user_id, exercise_name);

ALTER TABLE wellness.lifting_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lifting_sets: users access own rows"
  ON wellness.lifting_sets FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
