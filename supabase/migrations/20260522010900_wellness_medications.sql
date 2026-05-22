-- =============================================================================
-- wellness.medications - registry of meds I take or have taken. The actual
-- doses go in wellness.medication_logs, which references this row. A
-- medications row does NOT emit a shared.events row (it's a registry, not an
-- occurrence); a medication_logs row does ('medication_taken' event).
-- =============================================================================

CREATE TABLE wellness.medications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id            uuid NOT NULL REFERENCES shared.sources(id),

  name                 text NOT NULL,
  dosage               text,                 -- e.g. "500mg", "1 tablet"
  frequency            text,                 -- e.g. "daily", "as needed", "2x/day"

  started_on           date,
  ended_on             date,                 -- NULL means currently taking

  prescribing_doctor   text,
  purpose              text,
  notes                text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT medications_ended_after_started
    CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);

CREATE TRIGGER medications_set_updated_at
  BEFORE UPDATE ON wellness.medications
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX medications_user_active_idx
  ON wellness.medications (user_id)
  WHERE ended_on IS NULL;

ALTER TABLE wellness.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medications: users access own rows"
  ON wellness.medications FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
