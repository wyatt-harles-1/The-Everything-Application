-- =============================================================================
-- wellness.medication_logs - actual doses. One row per dose taken (or
-- intentionally skipped). Each row emits a 'medication_taken' event.
-- =============================================================================

CREATE TABLE wellness.medication_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id       uuid NOT NULL REFERENCES shared.sources(id),
  medication_id   uuid NOT NULL REFERENCES wellness.medications(id),

  taken_at        timestamptz NOT NULL,
  dose_taken      text,                  -- e.g. "500mg", "half a tablet"
  skipped         boolean NOT NULL DEFAULT false,
  notes           text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER medication_logs_set_updated_at
  BEFORE UPDATE ON wellness.medication_logs
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

-- Two common patterns: "all doses for medication X" and "all doses today/week".
CREATE INDEX medication_logs_med_time_idx
  ON wellness.medication_logs (medication_id, taken_at DESC);
CREATE INDEX medication_logs_user_time_idx
  ON wellness.medication_logs (user_id, taken_at DESC);

ALTER TABLE wellness.medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medication_logs: users access own rows"
  ON wellness.medication_logs FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
