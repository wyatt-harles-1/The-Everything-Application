-- =============================================================================
-- Phase 5 (integrations): idempotency guard for synced workouts.
--
-- When a third-party integration (Strava first) syncs an activity into
-- wellness.workouts, we need to recognize "I've already imported this one"
-- so re-running a sync never creates duplicates. external_id holds the
-- provider's own activity id (as text - Strava ids are bigints, others may
-- be opaque strings). It stays NULL for manually-logged workouts.
--
-- The uniqueness is scoped to (source_id, external_id): the same provider
-- account (one source row) can't import the same activity twice, but two
-- different sources could legitimately carry the same external_id string.
-- =============================================================================

ALTER TABLE wellness.workouts
  ADD COLUMN external_id text;

-- Partial unique index: only enforced for synced rows (external_id NOT NULL),
-- so the many manual workouts (external_id NULL) are unaffected.
CREATE UNIQUE INDEX workouts_source_external_id_unique
  ON wellness.workouts (source_id, external_id)
  WHERE external_id IS NOT NULL;
