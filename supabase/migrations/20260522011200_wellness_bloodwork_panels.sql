-- =============================================================================
-- wellness.bloodwork_panels - header row for a bloodwork draw. The individual
-- marker readings live in wellness.bloodwork_results (next migration). One
-- panel emits a 'bloodwork_panel' event; its results do not.
--
-- file_path optionally references an object in the `bloodwork` storage bucket
-- (created in a later migration), letting us upload the lab PDF alongside the
-- structured data.
-- =============================================================================

CREATE TABLE wellness.bloodwork_panels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id           uuid NOT NULL REFERENCES shared.sources(id),

  drawn_at            date NOT NULL,
  lab_name            text,
  ordering_provider   text,
  panel_type          text,                  -- e.g. "annual", "thyroid", "hormone"

  -- Storage object path: "{user_id}/{panel_id}.pdf". Nullable because manual
  -- structured entry without a file upload is a valid pattern.
  file_path           text,

  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER bloodwork_panels_set_updated_at
  BEFORE UPDATE ON wellness.bloodwork_panels
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX bloodwork_panels_user_time_idx
  ON wellness.bloodwork_panels (user_id, drawn_at DESC);

ALTER TABLE wellness.bloodwork_panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bloodwork_panels: users access own rows"
  ON wellness.bloodwork_panels FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
