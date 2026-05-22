-- =============================================================================
-- wellness.workouts - the parent record for any kind of workout.
-- Sub-tables (lifting_sets, cardio_sessions, mobility_entries) reference this
-- row to add their kind-specific detail. The workout itself is what emits a
-- shared.events row; its children do not.
-- =============================================================================

CREATE TABLE wellness.workouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES shared.sources(id),

  started_at  timestamptz NOT NULL,
  ended_at    timestamptz,

  -- Free-text + CHECK so adding a new kind later is a single ALTER (not a
  -- CREATE TYPE). 'sport' and 'other' have no sub-table - the parent workout
  -- row is enough.
  kind        text NOT NULL
                CHECK (kind IN ('lifting', 'running', 'cycling', 'swimming',
                                'mobility', 'walk', 'sport', 'other')),

  title              text,
  perceived_effort   integer CHECK (perceived_effort BETWEEN 1 AND 10),
  notes              text,
  location           text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- An ended_at before started_at would be a data entry mistake, not a valid
  -- "negative duration" workout.
  CONSTRAINT workouts_ended_after_started
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TRIGGER workouts_set_updated_at
  BEFORE UPDATE ON wellness.workouts
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX workouts_user_time_idx
  ON wellness.workouts (user_id, started_at DESC);

ALTER TABLE wellness.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workouts: users access own rows"
  ON wellness.workouts FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
