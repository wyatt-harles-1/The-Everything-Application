-- =============================================================================
-- wellness.sleep_sessions - one row per sleep period (typically one per night
-- but naps are valid). Both start_at and end_at are required so the event
-- recorder can compute duration; quality and other fields are optional.
-- =============================================================================

CREATE TABLE wellness.sleep_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id       uuid NOT NULL REFERENCES shared.sources(id),

  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,

  quality         integer CHECK (quality IS NULL OR quality BETWEEN 1 AND 10),
  interruptions   integer CHECK (interruptions IS NULL OR interruptions >= 0),
  dreams_notes    text,
  notes           text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sleep_sessions_end_after_start
    CHECK (end_at > start_at)
);

CREATE TRIGGER sleep_sessions_set_updated_at
  BEFORE UPDATE ON wellness.sleep_sessions
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX sleep_sessions_user_time_idx
  ON wellness.sleep_sessions (user_id, start_at DESC);

ALTER TABLE wellness.sleep_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sleep_sessions: users access own rows"
  ON wellness.sleep_sessions FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
