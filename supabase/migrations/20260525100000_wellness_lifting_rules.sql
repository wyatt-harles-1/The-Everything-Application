-- =============================================================================
-- Phase 4a4: wellness.lifting_rules - the FIRST module rules table (invariant
-- #8). Stores user-configurable knobs that the lifting module's actions and
-- suggestion logic consult before doing work. Master agent (Phase 4e) will
-- eventually read + write these rows the same way the user does today.
--
-- One row per user (user_id is PK). Upsert pattern: the actions create a
-- default row on first read if none exists.
-- =============================================================================

CREATE TABLE wellness.lifting_rules (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES shared.sources(id) ON DELETE RESTRICT,

  -- How many lifting sessions to plan per week.
  frequency_per_week  integer NOT NULL DEFAULT 3
                        CHECK (frequency_per_week >= 0
                               AND frequency_per_week <= 7),

  -- ISO weekday numbers (1=Mon ... 7=Sun) where the user prefers to lift.
  -- NULL = let the suggestion engine pick an even-spaced pattern.
  preferred_days      integer[],

  -- Default time of day for suggested sessions, "HH:MM" 24h. The engine
  -- uses this to set scheduled_for; the user can adjust per-instance.
  default_time        text NOT NULL DEFAULT '17:00'
                        CHECK (default_time ~ '^[0-9]{2}:[0-9]{2}$'),

  -- If true, AND the active mesocycle's current week is its deload week,
  -- the suggestion engine emits zero sessions for the week. Users on
  -- low-volume deloads can skip the noise.
  skip_deload         boolean NOT NULL DEFAULT false,

  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index isn't strictly needed (PK lookup is the only query), but enables
-- partial scans when the agent layer eventually wants "all users with
-- frequency_per_week >= 4" style queries.
CREATE INDEX lifting_rules_frequency_idx
  ON wellness.lifting_rules (frequency_per_week);

ALTER TABLE wellness.lifting_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own lifting rules" ON wellness.lifting_rules
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER lifting_rules_set_updated_at
  BEFORE UPDATE ON wellness.lifting_rules
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON wellness.lifting_rules TO authenticated;
