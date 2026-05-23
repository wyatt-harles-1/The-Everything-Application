-- =============================================================================
-- wellness.template_exercises - one row per exercise within a template.
--
-- exercise_id is the canonical link to wellness.exercises. exercise_name is
-- kept for backwards-compat and so users can author templates with movement
-- names not yet in their library (same pattern as lifting_sets). The CHECK
-- constraint ensures every row identifies an exercise one way or the other.
--
-- planned_sets is a jsonb array of set targets:
--   [
--     { "reps": 5, "weight_lbs": 225, "rpe": 7,   "is_warmup": false, "notes": "" },
--     { "reps": 5, "weight_lbs": 225, "rpe": 8,   "is_warmup": false, "notes": "" },
--     { "reps": 5, "weight_lbs": 225, "rpe": null,"is_warmup": false, "notes": "AMRAP" }
--   ]
-- jsonb because the shape is variable and the entire list moves as a unit -
-- relational normalization wouldn't buy us anything here.
-- =============================================================================

CREATE TABLE wellness.template_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id       uuid NOT NULL REFERENCES shared.sources(id),
  template_id     uuid NOT NULL
                    REFERENCES wellness.workout_templates(id) ON DELETE CASCADE,

  exercise_id     uuid REFERENCES wellness.exercises(id) ON DELETE SET NULL,
  exercise_name   text,
  position        integer NOT NULL CHECK (position >= 0),

  planned_sets    jsonb NOT NULL DEFAULT '[]'::jsonb,

  rest_seconds    integer CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  notes           text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT template_exercises_exercise_required
    CHECK (exercise_id IS NOT NULL OR exercise_name IS NOT NULL),

  -- One exercise can appear once per template at each position. We don't
  -- forbid the same exercise twice (supersets / multi-block plans), only
  -- duplicate positions.
  CONSTRAINT template_exercises_unique_position
    UNIQUE (template_id, position)
);

CREATE TRIGGER template_exercises_set_updated_at
  BEFORE UPDATE ON wellness.template_exercises
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

-- Pulling a template's exercises is the dominant access pattern; index it.
CREATE INDEX template_exercises_template_idx
  ON wellness.template_exercises (template_id, position);

ALTER TABLE wellness.template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_exercises: users access own rows"
  ON wellness.template_exercises FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
