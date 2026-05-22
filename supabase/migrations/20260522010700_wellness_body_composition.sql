-- =============================================================================
-- wellness.body_composition - periodic body measurements (weighing in,
-- scale readings, tape measurements). Every measurement is nullable so a
-- check-in with just a weight reading is a valid row.
-- =============================================================================

CREATE TABLE wellness.body_composition (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id            uuid NOT NULL REFERENCES shared.sources(id),

  measured_at          timestamptz NOT NULL,

  weight_lbs           numeric(6,2)
                         CHECK (weight_lbs IS NULL OR weight_lbs >= 0),
  body_fat_pct         numeric(5,2)
                         CHECK (body_fat_pct IS NULL OR
                                body_fat_pct BETWEEN 0 AND 100),
  skeletal_muscle_lbs  numeric(6,2)
                         CHECK (skeletal_muscle_lbs IS NULL OR
                                skeletal_muscle_lbs >= 0),

  -- Tape measurements (inches). All nullable.
  waist_in             numeric(5,2)
                         CHECK (waist_in IS NULL OR waist_in >= 0),
  chest_in             numeric(5,2)
                         CHECK (chest_in IS NULL OR chest_in >= 0),
  arm_in               numeric(5,2)
                         CHECK (arm_in IS NULL OR arm_in >= 0),
  thigh_in             numeric(5,2)
                         CHECK (thigh_in IS NULL OR thigh_in >= 0),

  notes                text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER body_composition_set_updated_at
  BEFORE UPDATE ON wellness.body_composition
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX body_composition_user_time_idx
  ON wellness.body_composition (user_id, measured_at DESC);

ALTER TABLE wellness.body_composition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "body_composition: users access own rows"
  ON wellness.body_composition FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
