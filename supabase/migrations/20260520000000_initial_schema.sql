-- =============================================================================
-- Initial schema for Life Hub — Phase 1 foundation.
--
-- This migration establishes the three core architectural patterns the rest
-- of the application is built on:
--
--   1. Per-domain Postgres schemas (wellness, productivity, shared). Each
--      future module lives in its own namespace so the database doesn't
--      flatten into one giant `public` schema as we grow. `finance` and
--      `knowledge` schemas will arrive in later phases.
--
--   2. A `shared.sources` table that tags every record in the system with
--      where it came from (manual entry, third-party integration, import).
--      This is what lets the unified `events` timeline below stay coherent
--      as we add more data ingestion paths.
--
--   3. A `shared.events` table — the universal timeline of meaningful
--      occurrences. Workouts, meals, calendar entries, transactions later —
--      each emits a row here pointing back to its detail record via
--      (detail_table, detail_id). This is the substrate cross-domain AI
--      queries will run against in later phases. Don't degrade it.
--
-- Row Level Security is enabled on every table from day one. Even though
-- there is only one user during development, the policies ARE the production
-- contract — turning RLS on after data exists is much harder than starting
-- with it on.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Schemas
-- -----------------------------------------------------------------------------
-- `public` is reserved for Supabase Auth and extensions. Application tables
-- live in domain-specific schemas.

CREATE SCHEMA IF NOT EXISTS shared;
CREATE SCHEMA IF NOT EXISTS wellness;
CREATE SCHEMA IF NOT EXISTS productivity;

-- Allow Supabase API roles to see these schemas. Row Level Security still
-- gates which rows each role can read or modify. The roles are created
-- automatically by Supabase:
--   anon          — unauthenticated requests
--   authenticated — signed-in users
--   service_role  — privileged server-side calls (bypasses RLS)

GRANT USAGE ON SCHEMA shared       TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA wellness     TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA productivity TO anon, authenticated, service_role;

-- Default privileges so future tables in these schemas inherit the same
-- access policy. Without this, every CREATE TABLE would need separate GRANTs.

ALTER DEFAULT PRIVILEGES IN SCHEMA shared
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA wellness
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA wellness
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA productivity
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA productivity
  GRANT SELECT ON TABLES TO anon;


-- -----------------------------------------------------------------------------
-- 2. Helper: shared.set_updated_at() trigger function
-- -----------------------------------------------------------------------------
-- Reusable BEFORE-UPDATE trigger that stamps the row's updated_at column with
-- the current time. Attach to any table that has an updated_at column.

CREATE OR REPLACE FUNCTION shared.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. shared.sources — registry of every data source
-- -----------------------------------------------------------------------------
-- Every record in the system carries a source_id pointing here. That's how
-- later-phase AI assistants can distinguish "I manually logged this workout"
-- from "Strava synced it" — they're both rows in the same workouts table,
-- separated only by source.

CREATE TABLE shared.sources (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Human-readable label shown in UI. e.g. "Manual", "Strava",
  -- "Plaid - Chase Checking".
  name                 text NOT NULL,

  -- How the source delivers data. CHECK keeps typos out.
  kind                 text NOT NULL
                         CHECK (kind IN ('manual', 'integration', 'import')),

  -- Which domain the source feeds. Mirrors the schema layout.
  domain               text NOT NULL
                         CHECK (domain IN ('wellness', 'productivity', 'finance', 'knowledge', 'shared')),

  -- Slug for the underlying provider; null for manual sources.
  -- e.g. "strava", "plaid", "google_calendar".
  provider             text,

  -- Identifier from the provider for the specific connected account.
  -- Lets a user connect, e.g., two separate Plaid accounts.
  external_account_id  text,

  -- Free-form per-source settings: OAuth tokens, polling cadence, mapping
  -- rules — anything we don't want to hard-code as a column.
  config               jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- One source per (user, provider, external_account). NULLS NOT DISTINCT
  -- (Postgres 15+) treats two NULLs as equal, so a user can only have a
  -- single "Manual" source (where both provider and external_account_id
  -- are NULL).
  CONSTRAINT sources_user_provider_account_unique
    UNIQUE NULLS NOT DISTINCT (user_id, provider, external_account_id)
);

CREATE TRIGGER sources_set_updated_at
  BEFORE UPDATE ON shared.sources
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

-- Common lookup: list a user's sources.
CREATE INDEX sources_user_id_idx ON shared.sources (user_id);


-- -----------------------------------------------------------------------------
-- 4. shared.events — universal timeline
-- -----------------------------------------------------------------------------
-- Every meaningful occurrence in the user's life writes a row here. The full
-- detail lives in a domain table (e.g. wellness.workouts in Phase 3); the
-- event row carries the high-level summary plus a (detail_table, detail_id)
-- pointer.
--
-- Why duplicate the data? Because later phases need to answer cross-domain
-- questions ("show me everything I did yesterday", "did my Strava workouts
-- correlate with my sleep this month") without joining ten domain tables.
-- The events table is the single chronological substrate AI agents will
-- query.

CREATE TABLE shared.events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Which source produced this event. Default ON DELETE behavior is RESTRICT,
  -- so a source with linked events can't be accidentally deleted — soft-delete
  -- via is_active = false instead. This protects the timeline's integrity.
  source_id         uuid NOT NULL REFERENCES shared.sources(id),

  domain            text NOT NULL
                      CHECK (domain IN ('wellness', 'productivity', 'finance', 'knowledge', 'shared')),

  -- High-level kind of occurrence. Free-text rather than enum so new modules
  -- can register their own types without a schema migration. e.g. 'workout',
  -- 'meal', 'sleep', 'calendar_event', 'transaction', 'bloodwork_panel'.
  event_type        text NOT NULL,

  occurred_at       timestamptz NOT NULL,
  duration_minutes  integer
                      CHECK (duration_minutes IS NULL OR duration_minutes >= 0),

  title             text,
  summary           text,

  -- Pointer to the full record. Both NULL for events that only need the
  -- summary level (e.g. a quick note); both SET for events backed by a
  -- detail table (e.g. an id in wellness.workouts).
  detail_table      text,
  detail_id         uuid,

  -- Free-form per-event extras the universal schema doesn't model directly.
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Either both detail columns are set or both are null — never half-and-half.
  CONSTRAINT events_detail_pair_consistency
    CHECK ((detail_table IS NULL) = (detail_id IS NULL))
);

-- Indexes optimized for the three most common access patterns. All DESC
-- because "what happened recently" is the dominant query.
CREATE INDEX events_user_time_idx
  ON shared.events (user_id, occurred_at DESC);
CREATE INDEX events_user_domain_time_idx
  ON shared.events (user_id, domain, occurred_at DESC);
CREATE INDEX events_user_type_time_idx
  ON shared.events (user_id, event_type, occurred_at DESC);


-- -----------------------------------------------------------------------------
-- 5. shared.goals — cross-domain goals
-- -----------------------------------------------------------------------------
-- One table for fitness goals, financial goals, learning goals, etc. Keeps
-- later-phase AI modules (personal trainer / financial advisor / doctor)
-- talking to a single, consistent goal API.

CREATE TABLE shared.goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title           text NOT NULL,
  description     text,

  domain          text NOT NULL
                    CHECK (domain IN ('wellness', 'productivity', 'finance', 'knowledge', 'shared')),

  -- Sub-domain bucket — free-text so each module can pick its own vocabulary.
  -- e.g. 'strength', 'cardio', 'savings', 'language'.
  category        text,

  -- Optional structured target. target_metric is a slug each domain defines:
  -- 'bench_1rm_lbs', '5k_time_seconds', etc.
  target_metric   text,
  target_value    numeric,
  target_date     date,

  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'achieved', 'abandoned')),
  priority        integer NOT NULL DEFAULT 3
                    CHECK (priority BETWEEN 1 AND 5),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON shared.goals
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

CREATE INDEX goals_user_status_priority_idx
  ON shared.goals (user_id, status, priority);


-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------
-- Policy: each user can only see and modify their own rows. auth.uid() is
-- Supabase's helper that returns the signed-in user's id from the JWT.
-- service_role bypasses RLS, so admin operations (like the /api/health route
-- handler) work normally.
--
-- A single FOR ALL policy covers select/insert/update/delete. The WITH CHECK
-- clause prevents a user from inserting or updating rows owned by someone
-- else, which USING alone wouldn't catch.

ALTER TABLE shared.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared.goals   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sources: users access own rows"
  ON shared.sources FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());

CREATE POLICY "events: users access own rows"
  ON shared.events FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());

CREATE POLICY "goals: users access own rows"
  ON shared.goals FOR ALL
  USING       (user_id = auth.uid())
  WITH CHECK  (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 7. Auto-create a "Manual" source for every new user
-- -----------------------------------------------------------------------------
-- Every user needs a "Manual" source row so the Phase 2 manual-logging UI
-- has something to tag entries with. Wiring this to auth.users INSERT means
-- the source exists from the moment a user signs up — no separate setup.
--
-- SECURITY DEFINER runs the function with the OWNER's privileges (i.e. the
-- migrating role, which can write to shared.sources) instead of the role
-- that triggered the auth.users INSERT (which is the supabase_auth_admin
-- role and can't reach `shared`). The empty search_path is a security
-- hardening practice for SECURITY DEFINER functions — prevents a malicious
-- schema in front of `shared` from intercepting the insert.

CREATE OR REPLACE FUNCTION shared.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO shared.sources (user_id, name, kind, domain)
  VALUES (NEW.id, 'Manual', 'manual', 'shared');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_create_manual_source
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION shared.handle_new_user();
