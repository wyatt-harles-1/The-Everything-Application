-- =============================================================================
-- Wire lifting_sets to the new wellness.exercises library.
--
-- Adds exercise_id as a nullable FK. exercise_name stays - older rows
-- predate the library, and quick free-text entries from the workout form
-- are still allowed. A new CHECK constraint enforces "at least one of the
-- two is populated" so a row always identifies which exercise it's for.
--
-- ON DELETE SET NULL on the FK: if a user deletes an exercise row from
-- the library, existing set rows fall back to the cached exercise_name
-- (or just NULL it if name was also blank). Better than ON DELETE CASCADE,
-- which would wipe training history.
-- =============================================================================

ALTER TABLE wellness.lifting_sets
  ADD COLUMN exercise_id uuid
    REFERENCES wellness.exercises(id) ON DELETE SET NULL;

-- exercise_name was NOT NULL before; loosen it so library-backed rows can
-- omit the cached name. The new CHECK below still ensures the row
-- identifies an exercise one way or the other.
ALTER TABLE wellness.lifting_sets
  ALTER COLUMN exercise_name DROP NOT NULL;

ALTER TABLE wellness.lifting_sets
  ADD CONSTRAINT lifting_sets_exercise_required
    CHECK (exercise_id IS NOT NULL OR exercise_name IS NOT NULL);

-- PR / history queries hit "all sets for (user, exercise)" hard. Add an
-- index that supports that path; the existing user_exercise_idx is on
-- exercise_name which is fine for legacy data, but exercise_id is the
-- canonical key going forward.
CREATE INDEX lifting_sets_user_exercise_id_idx
  ON wellness.lifting_sets (user_id, exercise_id)
  WHERE exercise_id IS NOT NULL;
