-- =============================================================================
-- wellness.workout_templates - reusable workout blueprints.
--
-- A template is "Push Day A" or "5/3/1 Bench" - a named, ordered list of
-- exercises with planned sets (target reps / weight / RPE). When you start a
-- session from a template, every planned set gets copied into the live
-- workout's lifting_sets so you can adjust as you actually train.
-- =============================================================================

CREATE TABLE wellness.workout_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id    uuid NOT NULL REFERENCES shared.sources(id),

  name         text NOT NULL,
  description  text,
  notes        text,

  -- Phase 3 only ships lifting templates, but the column is here so other
  -- kinds (mobility flow, cardio interval set) can hang off the same table.
  kind         text NOT NULL DEFAULT 'lifting'
                 CHECK (kind IN ('lifting', 'cardio', 'mobility', 'other')),

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT workout_templates_user_name_unique UNIQUE (user_id, name)
);

CREATE TRIGGER workout_templates_set_updated_at
  BEFORE UPDATE ON wellness.workout_templates
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX workout_templates_user_kind_idx
  ON wellness.workout_templates (user_id, kind);

ALTER TABLE wellness.workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_templates: users access own rows"
  ON wellness.workout_templates FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
