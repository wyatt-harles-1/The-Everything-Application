-- =============================================================================
-- shared.record_event / update_event_for_detail / delete_event_for_detail
--
-- Phase 2 uses EXPLICIT functions (called from Server Actions) rather than
-- AFTER triggers on every domain table. Reasons:
--
--   1. Visibility - a Server Action that calls record_event() right after
--      inserting a workout is self-documenting; a trigger on wellness.workouts
--      hides the same logic in a place you don't see when reading the form
--      code.
--   2. Debugging - if an event row goes missing or has wrong fields, you grep
--      the Server Action that wrote it, not the migrations.
--   3. Selectivity - lifting_sets, cardio_sessions, mobility_entries and
--      bloodwork_results do NOT emit events (only their parent does). Triggers
--      would either need per-table inclusion or per-table omission - either
--      way, more places to keep aligned.
--
-- The three functions cover the full insert / update / delete lifecycle.
-- Callers always identify the event by the (detail_table, detail_id) pair, the
-- same pair stored on shared.events, so callers never have to round-trip to
-- look up the event id.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. shared.record_event - INSERT a new shared.events row
-- -----------------------------------------------------------------------------
-- Called from a Server Action right after a successful INSERT into a domain
-- table. Returns the new event's id in case the caller wants to attach it to
-- something else later (Phase 2 doesn't use the return; Phase 6+ AI agents
-- might).
--
-- SECURITY INVOKER (the default) so the caller's RLS context applies - this
-- means a user can only create events for themselves, which is the same rule
-- enforced by the policy on shared.events.

CREATE OR REPLACE FUNCTION shared.record_event(
  p_user_id          uuid,
  p_source_id        uuid,
  p_domain           text,
  p_event_type       text,
  p_occurred_at      timestamptz,
  p_detail_table     text,
  p_detail_id        uuid,
  p_duration_minutes integer DEFAULT NULL,
  p_title            text    DEFAULT NULL,
  p_summary          text    DEFAULT NULL,
  p_metadata         jsonb   DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  new_event_id uuid;
BEGIN
  INSERT INTO shared.events (
    user_id, source_id, domain, event_type,
    occurred_at, duration_minutes,
    title, summary,
    detail_table, detail_id,
    metadata
  )
  VALUES (
    p_user_id, p_source_id, p_domain, p_event_type,
    p_occurred_at, p_duration_minutes,
    p_title, p_summary,
    p_detail_table, p_detail_id,
    p_metadata
  )
  RETURNING id INTO new_event_id;

  RETURN new_event_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. shared.update_event_for_detail - sync an event when its detail changes
-- -----------------------------------------------------------------------------
-- Called from a Server Action after a successful UPDATE on a domain table.
-- Locates the matching event by (detail_table, detail_id) and rewrites the
-- mutable fields. If no event exists yet (e.g. someone updates a row that was
-- inserted before the event-recording rule was in place), the update is a
-- no-op rather than an error - the caller can decide whether to call
-- record_event() in that case.
--
-- All field parameters are nullable; NULLs do NOT overwrite (we use COALESCE
-- on existing). This way a caller can update just the title without having to
-- pass everything else, which mirrors the partial-update shape of Server
-- Actions.

CREATE OR REPLACE FUNCTION shared.update_event_for_detail(
  p_detail_table     text,
  p_detail_id        uuid,
  p_occurred_at      timestamptz DEFAULT NULL,
  p_duration_minutes integer     DEFAULT NULL,
  p_title            text        DEFAULT NULL,
  p_summary          text        DEFAULT NULL,
  p_metadata         jsonb       DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE shared.events
     SET occurred_at      = COALESCE(p_occurred_at,      occurred_at),
         duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
         title            = COALESCE(p_title,            title),
         summary          = COALESCE(p_summary,          summary),
         metadata         = COALESCE(p_metadata,         metadata)
   WHERE detail_table = p_detail_table
     AND detail_id    = p_detail_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. shared.delete_event_for_detail - cascade an event delete from its detail
-- -----------------------------------------------------------------------------
-- Phase 2 uses hard deletes. When a Server Action deletes a workout/meal/etc.,
-- it calls this helper to remove the matching event row before deleting the
-- detail row (or after - either order works since they're separate tables).
--
-- No-op if no matching event exists.

CREATE OR REPLACE FUNCTION shared.delete_event_for_detail(
  p_detail_table text,
  p_detail_id    uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM shared.events
   WHERE detail_table = p_detail_table
     AND detail_id    = p_detail_id;
END;
$$;
