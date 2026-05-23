-- =============================================================================
-- Phase 3 Wave 5a enrichments:
--   * Tempo + RIR per set (RP-style fields, complementary to RPE)
--   * Per-exercise default rest timer (overrides the 90s global default)
--   * Bodyweight flag on exercises (weight column becomes "added weight")
-- =============================================================================

-- ----- lifting_sets: tempo + rir ------------------------------------------
--
-- tempo is a free-text "eccentric-pause-concentric-rest" string like "3-1-1-0"
-- (3-second lowering, 1-second pause at bottom, 1-second drive, 0-second
-- pause at top). Not parsed at the DB level - it's documentation for the
-- lifter.
--
-- rir (reps in reserve) is the RP-style alternative to RPE. RPE 10 maps to
-- RIR 0, RPE 9 -> RIR 1, etc. We let users record both because some coaches
-- prescribe one and not the other.

ALTER TABLE wellness.lifting_sets
  ADD COLUMN tempo text,
  ADD COLUMN rir numeric(3,1)
    CHECK (rir IS NULL OR (rir >= 0 AND rir <= 10));


-- ----- exercises: default_rest_seconds + is_bodyweight --------------------
--
-- default_rest_seconds: the gym-mode session timer counts down from this
-- value after each completed set on this exercise. If NULL, falls back to
-- 90s. Templates can still override per-exercise via template_exercises
-- .rest_seconds when starting from a template (template ergonomics
-- intentionally win - you set up the template knowing what you wanted).
--
-- is_bodyweight: when true, the lifting_sets.weight_lbs column represents
-- ADDED weight (positive = weighted pullup; 0 = pure bodyweight; we don't
-- model assistance / negative resistance yet). The UI surfaces this as
-- "+25 lbs" instead of "25 lbs" so the lifter knows what they were
-- carrying on top of their own weight.

ALTER TABLE wellness.exercises
  ADD COLUMN default_rest_seconds integer
    CHECK (default_rest_seconds IS NULL OR default_rest_seconds >= 0),
  ADD COLUMN is_bodyweight boolean NOT NULL DEFAULT false;
