-- =============================================================================
-- wellness.bloodwork_results - one row per marker on a bloodwork panel.
-- Does NOT emit its own event - the parent panel is the event.
--
-- Stores either a numeric value or a text value (for non-numeric markers like
-- "Negative" / "Detected"). Reference ranges and flags are optional because
-- many marker rows on a real lab report omit them.
-- =============================================================================

CREATE TABLE wellness.bloodwork_results (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id         uuid NOT NULL REFERENCES shared.sources(id),
  panel_id          uuid NOT NULL
                      REFERENCES wellness.bloodwork_panels(id) ON DELETE CASCADE,

  marker_name       text NOT NULL,         -- "TSH", "LDL", "Testosterone Total"

  value             numeric,               -- for numeric results
  value_text        text,                  -- for non-numeric ("Negative" etc.)
  unit              text,                  -- "mg/dL", "ng/mL", "ratio", ...

  reference_low     numeric,
  reference_high    numeric,
  flag              text                   -- "high" | "low" | "normal" | "critical"
                      CHECK (flag IS NULL OR
                             flag IN ('high', 'low', 'normal', 'critical')),

  notes             text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- At least one of value / value_text must be populated. Otherwise the row
  -- is just a marker name with no reading, which means nothing.
  CONSTRAINT bloodwork_results_value_or_text
    CHECK (value IS NOT NULL OR value_text IS NOT NULL)
);

CREATE TRIGGER bloodwork_results_set_updated_at
  BEFORE UPDATE ON wellness.bloodwork_results
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX bloodwork_results_panel_idx
  ON wellness.bloodwork_results (panel_id);

-- Trend queries: "show me TSH over time"
CREATE INDEX bloodwork_results_user_marker_idx
  ON wellness.bloodwork_results (user_id, marker_name);

ALTER TABLE wellness.bloodwork_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bloodwork_results: users access own rows"
  ON wellness.bloodwork_results FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
