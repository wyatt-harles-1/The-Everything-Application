-- =============================================================================
-- Phase 4e1: shared.user_ai_settings - per-user AI configuration.
--
-- Stores which LLM provider + model the user picked plus their (encrypted)
-- API key. Encryption uses AES-GCM with a server-side master key from
-- env; without that env var, encrypted columns can't be read so the API
-- gracefully errors instead of leaking plaintext. RLS scopes rows per
-- user as always.
--
-- One row per user (user_id is PK); the settings action upserts on first
-- save. Until the user has a row, the app falls back to a "managed key"
-- env var if one is configured.
-- =============================================================================

CREATE TABLE shared.user_ai_settings (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Which provider's SDK to call. The frontend's settings UI restricts
  -- to providers the app supports today; the CHECK is the source of truth.
  provider          text NOT NULL DEFAULT 'anthropic'
                      CHECK (provider IN ('anthropic', 'openai', 'google',
                                          'mistral', 'groq')),

  -- Provider-specific model id, e.g. 'claude-opus-4-7', 'gpt-5',
  -- 'gemini-2.5-pro'. NULL = use the app's default for that provider.
  model_id          text,

  -- AES-GCM-encrypted API key, base64. NULL = use managed key (env var)
  -- if available. Plaintext is never stored at rest.
  api_key_encrypted text,

  -- When true, ignore api_key_encrypted and use the app's managed env-var
  -- key. Only valid when the user has explicitly opted in (UI gates this
  -- behind a "use the app's key" toggle).
  use_managed_key   boolean NOT NULL DEFAULT false,

  notes             text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shared.user_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own AI settings"
  ON shared.user_ai_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_ai_settings_set_updated_at
  BEFORE UPDATE ON shared.user_ai_settings
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON shared.user_ai_settings TO authenticated;
