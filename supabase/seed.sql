-- =============================================================================
-- Seed data — applied on every `supabase db reset`.
-- =============================================================================
-- The migration installs a trigger that auto-creates a "Manual" source for
-- every new auth.users row, so freshly signed-up users always have one.
--
-- This seed file BACKFILLS the "Manual" source for any pre-existing users —
-- useful when you sign up via Supabase Studio or Dashboard and only later
-- run the migrations, or when copying database state around in development.
--
-- It is a no-op on a clean `supabase db reset` because the reset wipes
-- auth.users first. To exercise the system end-to-end locally:
--
--   1. supabase start         # local Postgres + Studio + Auth via Docker
--   2. supabase db reset      # apply migrations and (no-op) seed
--   3. Open http://localhost:54323 (Studio) → Authentication → Add user
--   4. The trigger automatically inserts a row in shared.sources for the
--      new user. Verify in the Table Editor.

INSERT INTO shared.sources (user_id, name, kind, domain)
SELECT u.id, 'Manual', 'manual', 'shared'
  FROM auth.users u
 WHERE NOT EXISTS (
   SELECT 1
     FROM shared.sources s
    WHERE s.user_id = u.id
      AND s.provider IS NULL
      AND s.external_account_id IS NULL
 );
