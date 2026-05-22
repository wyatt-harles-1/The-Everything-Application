-- =============================================================================
-- wellness.mood_entries - daily-ish mental/emotional check-in. Mood is the
-- only required scale; everything else (energy, stress, anxiety) is optional
-- so a quick "feeling 6/10" entry is a valid row.
-- =============================================================================

CREATE TABLE wellness.mood_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id    uuid NOT NULL REFERENCES shared.sources(id),

  occurred_at  timestamptz NOT NULL,

  mood         integer NOT NULL CHECK (mood    BETWEEN 1 AND 10),
  energy       integer          CHECK (energy  IS NULL OR energy  BETWEEN 1 AND 10),
  stress       integer          CHECK (stress  IS NULL OR stress  BETWEEN 1 AND 10),
  anxiety      integer          CHECK (anxiety IS NULL OR anxiety BETWEEN 1 AND 10),

  notes        text,

  -- Free-form labels: "post-workout", "morning", "after-bad-meeting" etc.
  -- Used later for filtering / pattern queries.
  tags         text[],

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER mood_entries_set_updated_at
  BEFORE UPDATE ON wellness.mood_entries
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX mood_entries_user_time_idx
  ON wellness.mood_entries (user_id, occurred_at DESC);

-- GIN index on tags so filter-by-tag queries don't have to scan.
CREATE INDEX mood_entries_tags_gin_idx
  ON wellness.mood_entries USING GIN (tags);

ALTER TABLE wellness.mood_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mood_entries: users access own rows"
  ON wellness.mood_entries FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());
