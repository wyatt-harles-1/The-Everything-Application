-- =============================================================================
-- wellness.meals - manual food logging. Macros are all optional so the form
-- can default to "what I ate + when" without forcing nutrition data entry.
-- =============================================================================

CREATE TABLE wellness.meals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id    uuid NOT NULL REFERENCES shared.sources(id),

  occurred_at  timestamptz NOT NULL,

  -- Nullable per spec - sometimes you log a snack you don't want to label.
  meal_type    text
                 CHECK (meal_type IS NULL OR
                        meal_type IN ('breakfast', 'lunch', 'dinner',
                                      'snack', 'other')),

  -- 'description' rather than 'name' so the form prompt feels like
  -- journalling ("what did you eat?") not labelling.
  description  text NOT NULL,

  calories     integer       CHECK (calories IS NULL OR calories >= 0),
  protein_g    numeric(6,2)  CHECK (protein_g IS NULL OR protein_g >= 0),
  carbs_g      numeric(6,2)  CHECK (carbs_g IS NULL OR carbs_g >= 0),
  fat_g        numeric(6,2)  CHECK (fat_g IS NULL OR fat_g >= 0),
  fiber_g      numeric(6,2)  CHECK (fiber_g IS NULL OR fiber_g >= 0),

  notes        text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER meals_set_updated_at
  BEFORE UPDATE ON wellness.meals
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX meals_user_time_idx
  ON wellness.meals (user_id, occurred_at DESC);

ALTER TABLE wellness.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meals: users access own rows"
  ON wellness.meals FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
