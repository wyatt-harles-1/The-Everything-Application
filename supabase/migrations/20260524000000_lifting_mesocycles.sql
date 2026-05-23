-- =============================================================================
-- Phase 3 Wave 5c: mesocycle tracking.
--   * wellness.mesocycles - user-defined training blocks (typically 3-6 weeks
--     of progressive overload + a deload).
--   * wellness.workouts.mesocycle_id - optional FK so each session can be
--     tagged to a block for week-by-week aggregation.
-- =============================================================================

-- ----- wellness.mesocycles -------------------------------------------------
--
-- One row per training block. RP-style: a `planned_weeks` length (typically
-- 4-6) plus an optional `deload_week_number` (usually the last week). When
-- the user marks the meso complete by setting ended_at, the partial unique
-- index lets them start a new one without conflict.

CREATE TABLE wellness.mesocycles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES shared.sources(id) ON DELETE RESTRICT,

  name                text NOT NULL,
  started_at          date NOT NULL,
  planned_weeks       integer NOT NULL
                        CHECK (planned_weeks >= 1 AND planned_weeks <= 26),
  -- 1-indexed week number that's earmarked as the deload (usually the
  -- last week). NULL = no scheduled deload.
  deload_week_number  integer
                        CHECK (
                          deload_week_number IS NULL
                          OR (deload_week_number >= 1
                              AND deload_week_number <= planned_weeks)
                        ),
  -- NULL = currently active. Filled when the user closes the block.
  ended_at            date,
  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- One active mesocycle at a time per user. ended_at IS NULL marks "live."
-- Partial unique index lets unlimited completed mesos coexist.
CREATE UNIQUE INDEX one_active_meso_per_user
  ON wellness.mesocycles (user_id)
  WHERE ended_at IS NULL;

CREATE INDEX mesocycles_user_started_idx
  ON wellness.mesocycles (user_id, started_at DESC);

ALTER TABLE wellness.mesocycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own mesocycles" ON wellness.mesocycles
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- updated_at touch trigger (same pattern as the rest of wellness)
CREATE TRIGGER mesocycles_set_updated_at
  BEFORE UPDATE ON wellness.mesocycles
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON wellness.mesocycles TO authenticated;


-- ----- wellness.workouts.mesocycle_id --------------------------------------
--
-- Workouts opt-in to a mesocycle. ON DELETE SET NULL preserves the workout
-- if the user later removes the meso. Most workouts will be auto-tagged
-- with the currently-active meso at session start.

ALTER TABLE wellness.workouts
  ADD COLUMN mesocycle_id uuid
    REFERENCES wellness.mesocycles(id) ON DELETE SET NULL;

CREATE INDEX workouts_mesocycle_idx
  ON wellness.workouts (mesocycle_id)
  WHERE mesocycle_id IS NOT NULL;
