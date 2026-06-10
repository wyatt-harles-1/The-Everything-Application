-- =============================================================================
-- UI redesign milestone 1: shared.user_preferences — per-user UI preferences.
--
-- Stores appearance settings (theme / accent / density) plus the home
-- dashboard layout (widget order + which widgets are hidden). One row per
-- user (user_id PK), upserted by the appearance + dashboard server actions.
--
-- A cookie (`lh_prefs`) mirrors theme/accent/density so the server layout can
-- set the <html> attributes before first paint with no flash; this table is
-- the cross-device source of truth. The app degrades gracefully if this table
-- is absent (cookie-only), so theming works even before the migration lands.
--
-- RLS scopes every row to its owner, same as shared.user_ai_settings.
-- =============================================================================

CREATE TABLE shared.user_preferences (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Appearance. The frontend restricts choices; these CHECKs are the source
  -- of truth and keep junk out of the column.
  theme        text NOT NULL DEFAULT 'system'
                 CHECK (theme IN ('system', 'light', 'dark', 'amoled')),
  accent       text NOT NULL DEFAULT 'indigo'
                 CHECK (accent IN ('indigo', 'emerald', 'rose', 'amber',
                                   'violet', 'sky')),
  density      text NOT NULL DEFAULT 'comfortable'
                 CHECK (density IN ('comfortable', 'compact')),

  -- Home dashboard layout: { "order": ["today", ...], "hidden": ["recent"] }.
  -- NULL = use the app's default order with nothing hidden.
  home_layout  jsonb,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shared.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own preferences"
  ON shared.user_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_preferences_set_updated_at
  BEFORE UPDATE ON shared.user_preferences
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON shared.user_preferences TO authenticated;
