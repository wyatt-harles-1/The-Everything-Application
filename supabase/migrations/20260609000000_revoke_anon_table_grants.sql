-- =============================================================================
-- Security hardening: remove the standing SELECT grant the `anon` role holds
-- on every table in the API-exposed schemas.
--
-- WHY THIS EXISTS
-- The initial schema (20260520000000) granted `anon` SELECT on all current and
-- future tables in shared / wellness / productivity, on the assumption that RLS
-- would be the gate. That works — but it makes RLS the *only* lock. The grant
-- layer is supposed to be a second, independent lock: if any future table is
-- ever created without `ENABLE ROW LEVEL SECURITY` (or a policy is dropped by
-- mistake), that table would become fully readable by anyone holding the public
-- anon key, with no login required:
--     GET /rest/v1/<table>?apikey=<anon_key>   (Accept-Profile: wellness)
-- Given the data here (medications, bloodwork, mood, cycle), one forgotten RLS
-- line would expose the entire health record.
--
-- This app has NO anonymous read path — every page sits behind auth (the (app)
-- layout guard + RLS) and the passcode gate. So `anon` never legitimately needs
-- table SELECT. Removing the grant makes a forgotten-RLS table fail CLOSED at
-- the grant layer instead of leaking.
--
-- We intentionally KEEP `GRANT USAGE ON SCHEMA ... TO anon` so PostgREST schema
-- introspection and the auth/login surface keep working; only the table-level
-- read privilege is withdrawn. `authenticated` and `service_role` are untouched.
-- =============================================================================

-- 1. Stop future tables in these schemas from inheriting an anon SELECT grant.
--    (Reverses the ALTER DEFAULT PRIVILEGES ... GRANT SELECT ... TO anon lines
--    in the initial migration.)
ALTER DEFAULT PRIVILEGES IN SCHEMA shared       REVOKE SELECT ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA wellness     REVOKE SELECT ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA productivity REVOKE SELECT ON TABLES FROM anon;

-- 2. Withdraw the grant from every table that already exists.
REVOKE SELECT ON ALL TABLES IN SCHEMA shared       FROM anon;
REVOKE SELECT ON ALL TABLES IN SCHEMA wellness     FROM anon;
REVOKE SELECT ON ALL TABLES IN SCHEMA productivity FROM anon;
