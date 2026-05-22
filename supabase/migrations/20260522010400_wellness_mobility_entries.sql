-- =============================================================================
-- wellness.mobility_entries - detail for mobility / stretching workouts.
-- One row per parent workout. Like cardio_sessions, the workout is the event;
-- this is just the detail.
-- =============================================================================

CREATE TABLE wellness.mobility_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id         uuid NOT NULL REFERENCES shared.sources(id),
  workout_id        uuid NOT NULL UNIQUE
                      REFERENCES wellness.workouts(id) ON DELETE CASCADE,

  focus_area        text,  -- e.g. "hips", "shoulders", "full body"
  protocol          text,  -- e.g. "Knees Over Toes warmup"
  duration_minutes  integer
                      CHECK (duration_minutes IS NULL OR duration_minutes >= 0),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER mobility_entries_set_updated_at
  BEFORE UPDATE ON wellness.mobility_entries
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

ALTER TABLE wellness.mobility_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mobility_entries: users access own rows"
  ON wellness.mobility_entries FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
