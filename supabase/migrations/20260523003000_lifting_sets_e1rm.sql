-- =============================================================================
-- e1RM (estimated 1-rep-max) as a generated column on lifting_sets.
--
-- Epley formula:   e1RM = weight × (1 + reps / 30)
-- Chosen over Brzycki for simplicity; both produce similar numbers at the
-- usual rep ranges (1-12). The column is GENERATED ALWAYS AS ... STORED so
-- Postgres computes it once on insert/update and queries / indexes can use
-- it without re-deriving each time.
--
-- A set with NULL or 0 reps (warmups that didn't get logged, mistakes) gets
-- NULL e1rm - dashboard queries skip them.
-- =============================================================================

ALTER TABLE wellness.lifting_sets
  ADD COLUMN e1rm_lbs numeric(7,2)
    GENERATED ALWAYS AS (
      CASE
        WHEN weight_lbs IS NOT NULL
         AND reps IS NOT NULL
         AND reps > 0
        THEN weight_lbs * (1 + reps::numeric / 30)
        ELSE NULL
      END
    ) STORED;

-- "Max e1rm per (user, exercise)" is the PR query. Index it.
CREATE INDEX lifting_sets_user_exercise_e1rm_idx
  ON wellness.lifting_sets (user_id, exercise_id, e1rm_lbs DESC)
  WHERE completed_at IS NOT NULL
    AND exercise_id IS NOT NULL
    AND e1rm_lbs IS NOT NULL;
