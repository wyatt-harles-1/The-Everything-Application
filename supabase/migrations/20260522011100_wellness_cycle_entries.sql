-- =============================================================================
-- wellness.cycle_entries - daily-ish menstrual / hormonal cycle log. Built
-- now to keep the schema honest; using it is optional. Date-level (not
-- timestamptz) because cycle data is logged per-day, not per-moment.
-- =============================================================================

CREATE TABLE wellness.cycle_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id    uuid NOT NULL REFERENCES shared.sources(id),

  occurred_at  date NOT NULL,

  -- Cycle phase. Free-text + CHECK so adding "pre-menstrual" later is one
  -- ALTER, not a CREATE TYPE.
  phase        text
                 CHECK (phase IS NULL OR
                        phase IN ('menstrual', 'follicular', 'ovulation', 'luteal')),

  flow         text
                 CHECK (flow IS NULL OR
                        flow IN ('none', 'light', 'medium', 'heavy')),

  -- Free-form set of symptoms. Backed by a GIN index for filter queries.
  symptoms     text[],

  notes        text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER cycle_entries_set_updated_at
  BEFORE UPDATE ON wellness.cycle_entries
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX cycle_entries_user_time_idx
  ON wellness.cycle_entries (user_id, occurred_at DESC);
CREATE INDEX cycle_entries_symptoms_gin_idx
  ON wellness.cycle_entries USING GIN (symptoms);

ALTER TABLE wellness.cycle_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cycle_entries: users access own rows"
  ON wellness.cycle_entries FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
