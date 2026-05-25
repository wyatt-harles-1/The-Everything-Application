-- =============================================================================
-- Phase 4d-running: schema additions for the running module.
--   * wellness.shoes - tracked footwear for mileage rotation
--   * wellness.cardio_sessions.shoe_id - link a run to a specific pair
--   * wellness.running_rules - module rules table (invariant #8 stub)
-- =============================================================================

-- ----- wellness.shoes -----------------------------------------------------
-- One row per pair the user owns/owned. Mileage is derived by SUM over
-- linked cardio_sessions - no stored counter to drift.

CREATE TABLE wellness.shoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES shared.sources(id) ON DELETE RESTRICT,

  name        text NOT NULL,                      -- "Daily blue Endorphins"
  brand       text,                               -- "Saucony"
  model       text,                               -- "Endorphin Speed 4"

  -- Optional planned retirement mileage. NULL = no auto-retire prompt.
  -- Stored in meters for parity with cardio_sessions.distance_meters.
  retire_at_meters    numeric(10,2)
                        CHECK (retire_at_meters IS NULL OR retire_at_meters >= 0),

  started_at  date NOT NULL DEFAULT CURRENT_DATE, -- in rotation since
  retired_at  date,                               -- NULL = still active
  notes       text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shoes_user_active_idx
  ON wellness.shoes (user_id)
  WHERE retired_at IS NULL;

ALTER TABLE wellness.shoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own shoes" ON wellness.shoes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER shoes_set_updated_at
  BEFORE UPDATE ON wellness.shoes
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON wellness.shoes TO authenticated;


-- ----- wellness.cardio_sessions.shoe_id ----------------------------------
-- Optional link: every cardio session can be attributed to a pair. Past
-- sessions stay NULL until manually edited; new sessions get the active
-- pair by default in the form layer.

ALTER TABLE wellness.cardio_sessions
  ADD COLUMN shoe_id uuid REFERENCES wellness.shoes(id) ON DELETE SET NULL;

CREATE INDEX cardio_sessions_shoe_idx
  ON wellness.cardio_sessions (shoe_id)
  WHERE shoe_id IS NOT NULL;


-- ----- wellness.running_rules (invariant #8 stub) -------------------------
-- Second module rules table. Mirrors wellness.lifting_rules' shape so the
-- agent-tool surface stays uniform across modules. UI for this lands in
-- a follow-up sub-wave - the table exists now so the data shape doesn't
-- need a migration later.

CREATE TABLE wellness.running_rules (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES shared.sources(id) ON DELETE RESTRICT,

  frequency_per_week  integer NOT NULL DEFAULT 3
                        CHECK (frequency_per_week >= 0
                               AND frequency_per_week <= 7),
  preferred_days      integer[],
  default_time        text NOT NULL DEFAULT '07:00'
                        CHECK (default_time ~ '^[0-9]{2}:[0-9]{2}$'),
  -- Default planned distance for suggestions, stored in meters.
  default_distance_meters numeric(10,2)
                            CHECK (default_distance_meters IS NULL
                                   OR default_distance_meters >= 0),
  -- Active shoe for default attribution on new runs.
  active_shoe_id      uuid REFERENCES wellness.shoes(id) ON DELETE SET NULL,
  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wellness.running_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own running rules" ON wellness.running_rules
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER running_rules_set_updated_at
  BEFORE UPDATE ON wellness.running_rules
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON wellness.running_rules TO authenticated;
