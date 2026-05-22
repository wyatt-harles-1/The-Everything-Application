-- =============================================================================
-- wellness.cardio_sessions - detail for cardio-flavored workouts
-- (running / cycling / swimming / walk). One row per parent workout. The
-- workout kind tells you which cardio sub-table to read for detail.
-- Single table covers all four; if a sport diverges hard enough later we can
-- split.
-- =============================================================================

CREATE TABLE wellness.cardio_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id             uuid NOT NULL REFERENCES shared.sources(id),
  workout_id            uuid NOT NULL UNIQUE
                          REFERENCES wellness.workouts(id) ON DELETE CASCADE,

  distance_meters       numeric(10,2)
                          CHECK (distance_meters IS NULL OR distance_meters >= 0),
  duration_seconds      integer
                          CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  avg_heart_rate        integer
                          CHECK (avg_heart_rate IS NULL OR avg_heart_rate BETWEEN 0 AND 300),
  max_heart_rate        integer
                          CHECK (max_heart_rate IS NULL OR max_heart_rate BETWEEN 0 AND 300),
  elevation_gain_meters numeric(8,2)
                          CHECK (elevation_gain_meters IS NULL OR elevation_gain_meters >= 0),

  route_notes           text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER cardio_sessions_set_updated_at
  BEFORE UPDATE ON wellness.cardio_sessions
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

ALTER TABLE wellness.cardio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cardio_sessions: users access own rows"
  ON wellness.cardio_sessions FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
