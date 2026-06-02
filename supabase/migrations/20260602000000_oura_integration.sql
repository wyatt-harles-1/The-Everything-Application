-- =============================================================================
-- Phase 5c (Oura integration): sleep idempotency + a recovery table.
--
--   * wellness.sleep_sessions.external_id - lets a synced sleep period be
--     recognized on re-sync (mirrors the workouts.external_id guard).
--   * wellness.readiness - daily recovery metrics from Oura's daily_readiness:
--     readiness score, plus HRV / resting HR borrowed from that night's sleep,
--     and Oura's body-temperature deviation. No manual logging surface yet;
--     populated by the Oura connector. One row per (source, external_id).
-- =============================================================================

-- ----- wellness.sleep_sessions.external_id --------------------------------
-- The provider's own id (Oura sleep document id) for synced rows; NULL for
-- manually-logged sleep. Uniqueness scoped to the source so re-syncing the
-- same night can't duplicate it.
ALTER TABLE wellness.sleep_sessions
  ADD COLUMN external_id text;

CREATE UNIQUE INDEX sleep_sessions_source_external_id_unique
  ON wellness.sleep_sessions (source_id, external_id)
  WHERE external_id IS NOT NULL;


-- ----- wellness.readiness -------------------------------------------------
-- One row per day of recovery data. HRV/resting-HR are the raw values from
-- that day's main sleep (Oura exposes them on the sleep document, not on
-- daily_readiness); score + temp_deviation come from daily_readiness.

CREATE TABLE wellness.readiness (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES shared.sources(id),

  -- Provider's daily_readiness document id; NULL would mean "not from a
  -- provider" but readiness has no manual entry path today.
  external_id text,

  day         date NOT NULL,                          -- the readiness day
  score       integer CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  hrv_avg     integer,                                -- ms, avg HRV from sleep
  resting_hr  integer,                                -- bpm, lowest HR from sleep
  temp_deviation numeric(4,2),                        -- °C from baseline

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX readiness_user_day_idx
  ON wellness.readiness (user_id, day DESC);

-- Idempotency guard: a source can't import the same readiness day twice.
CREATE UNIQUE INDEX readiness_source_external_id_unique
  ON wellness.readiness (source_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE wellness.readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own readiness" ON wellness.readiness
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER readiness_set_updated_at
  BEFORE UPDATE ON wellness.readiness
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON wellness.readiness TO authenticated;
