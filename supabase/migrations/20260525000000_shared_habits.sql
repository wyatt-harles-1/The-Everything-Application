-- =============================================================================
-- Phase 4a3: shared.habits - recurring behaviors the user wants to track.
--
-- A habit is "lift 3x/week", "meditate daily" (=7x/week), "log meals daily",
-- etc. The MATCHING events come from shared.events (filtered by domain +
-- optional event_type), so no separate habit_completions table - any event
-- of the right type counts. This keeps the model self-syncing: anything
-- that emits a timeline event automatically advances the habit.
--
-- Streak math is derived in application code from shared.events:
--   - Current week's progress: count matching events since this Monday
--   - Streak: walk past weeks backward, increment while target was met
--
-- We deliberately do not store streak/progress columns on the habit row -
-- they'd drift the moment the user retroactively logs (or deletes) an event.
-- =============================================================================

CREATE TABLE shared.habits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id   uuid NOT NULL REFERENCES shared.sources(id) ON DELETE RESTRICT,

  name        text NOT NULL,
  domain      text NOT NULL
                CHECK (domain IN ('wellness', 'productivity', 'finance',
                                  'knowledge', 'shared')),
  -- Optional further filter. NULL = any event_type in the domain counts.
  -- Common values: 'workout', 'meal', 'meditation', etc. (free text - the
  -- shared.events.event_type column is free text too, by design.)
  event_type  text,

  -- Per-week target. 1 = once a week. 7 = daily. We don't model "5x/month"
  -- or "twice a day" yet; the per-week shape covers ~all common habits.
  target_frequency_per_week  integer NOT NULL DEFAULT 1
    CHECK (target_frequency_per_week >= 1
           AND target_frequency_per_week <= 14),

  -- Soft-archive: keeps streak history queryable without cluttering the
  -- active list.
  active      boolean NOT NULL DEFAULT true,
  -- Earliest date events count toward this habit. Defaults to today; user
  -- can backdate to credit existing history.
  started_at  date NOT NULL DEFAULT CURRENT_DATE,
  notes       text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX habits_user_active_idx
  ON shared.habits (user_id)
  WHERE active = true;

CREATE INDEX habits_user_started_idx
  ON shared.habits (user_id, started_at DESC);

ALTER TABLE shared.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own habits" ON shared.habits
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER habits_set_updated_at
  BEFORE UPDATE ON shared.habits
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON shared.habits TO authenticated;
