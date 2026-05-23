-- =============================================================================
-- Add completed_at to lifting_sets so the live session UI can distinguish
-- "set logged, you crushed it" from "set planned, hasn't happened yet."
--
-- Set when the gym-mode UI hits "Complete" on a row. NULL means the set
-- still has planned values waiting to be confirmed (or is a freshly-added
-- blank row). The original /log/workout flow doesn't have a concept of
-- completion - rows it inserts come in with completed_at NULL too, which
-- is fine because the timeline / history queries don't filter on it.
-- =============================================================================

ALTER TABLE wellness.lifting_sets
  ADD COLUMN completed_at timestamptz;

-- "Most recent completed set for (user, exercise)" is the load-bearing
-- query the gym-mode UI uses to show last-session performance. Partial
-- index keeps it small.
CREATE INDEX lifting_sets_user_exercise_completed_idx
  ON wellness.lifting_sets (user_id, exercise_id, completed_at DESC)
  WHERE completed_at IS NOT NULL AND exercise_id IS NOT NULL;
