-- =============================================================================
-- Phase 4a1: shared.scheduled_events — future-tense counterpart to
-- shared.events. Every planned occurrence (lifting session, meal prep,
-- meditation block, etc.) gets a row here. When the user marks it done,
-- the row's status flips and a corresponding shared.events row is emitted
-- so the timeline + analytics keep working unchanged.
--
-- Schema deliberately includes recurrence_rule + parent_scheduled_id +
-- detail_table/detail_id columns now (nullable) so Phase 4a2 (recurring
-- tasks) and Phase 4a3 (habits) don't need follow-up migrations against
-- this table.
-- =============================================================================

CREATE TYPE shared.scheduled_event_status AS ENUM (
  'planned',
  'done',
  'skipped',
  'missed'
);

CREATE TABLE shared.scheduled_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id     uuid NOT NULL REFERENCES shared.sources(id) ON DELETE RESTRICT,

  domain        text NOT NULL
                  CHECK (domain IN ('wellness', 'productivity', 'finance',
                                    'knowledge', 'shared')),
  event_type    text NOT NULL,
  scheduled_for timestamptz NOT NULL,

  -- Phase 4a2: recurrence stored as a JSON descriptor. NULL = one-off.
  -- Shape will be finalized when 4a2 lands; until then queries should
  -- treat any non-null value as "this is a recurring series template."
  recurrence_rule      jsonb,
  -- For materialized recurring instances: points back to the series
  -- template row. NULL for one-offs and for the series templates
  -- themselves.
  parent_scheduled_id  uuid REFERENCES shared.scheduled_events(id) ON DELETE CASCADE,

  -- Optional link to a specific detail row that should be created/opened
  -- when the user marks the planned event done (e.g., a planned lifting
  -- session might link to a pre-built wellness.workouts row). Not enforced
  -- at the DB level - upstream code populates these when relevant.
  detail_table  text,
  detail_id     uuid,

  title         text NOT NULL,
  notes         text,
  status        shared.scheduled_event_status NOT NULL DEFAULT 'planned',

  -- When status = 'done', the realized shared.events row. NULL if the
  -- user just flipped status without emitting an event.
  completed_event_id uuid REFERENCES shared.events(id) ON DELETE SET NULL,
  completed_at       timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Calendar / agenda queries scan by date range, so index on the natural
-- access key.
CREATE INDEX scheduled_events_user_scheduled_idx
  ON shared.scheduled_events (user_id, scheduled_for);

-- "What's still planned?" is a hot query for the dashboard + agenda.
-- Partial index keeps it tight.
CREATE INDEX scheduled_events_user_planned_idx
  ON shared.scheduled_events (user_id, scheduled_for)
  WHERE status = 'planned';

ALTER TABLE shared.scheduled_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own scheduled events"
  ON shared.scheduled_events
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER scheduled_events_set_updated_at
  BEFORE UPDATE ON shared.scheduled_events
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON shared.scheduled_events TO authenticated;
GRANT USAGE ON TYPE shared.scheduled_event_status TO authenticated;
