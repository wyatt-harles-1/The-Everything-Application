-- =============================================================================
-- Phase 4e5: chat persistence + assistant memory.
--
--   * shared.chat_threads - one row per conversation; tracks last activity
--     for the threads list view.
--   * shared.chat_messages - per-turn rows with `parts jsonb` preserving the
--     AI SDK message-parts shape verbatim (text + tool calls + tool results).
--     Storing the parts blob unchanged means /assistant can hydrate useChat
--     without lossy round-tripping.
--   * shared.assistant_memory - facts the agent should carry across sessions
--     ("prefers morning workouts", "uses lbs not kg"). Injected into the
--     system prompt on every chat call by the route handler.
-- =============================================================================

-- ----- shared.chat_threads ------------------------------------------------

CREATE TABLE shared.chat_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title           text,
  -- Touched by the chat route every time a message is appended so the
  -- threads list can sort recent-first without scanning chat_messages.
  last_message_at timestamptz NOT NULL DEFAULT now(),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_threads_user_recent_idx
  ON shared.chat_threads (user_id, last_message_at DESC);

ALTER TABLE shared.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own chat threads"
  ON shared.chat_threads FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER chat_threads_set_updated_at
  BEFORE UPDATE ON shared.chat_threads
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON shared.chat_threads TO authenticated;


-- ----- shared.chat_messages -----------------------------------------------

CREATE TABLE shared.chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES shared.chat_threads(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role        text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  -- The AI SDK UIMessage.parts array as JSON. Preserves text parts,
  -- tool-call parts (input + output + state), and any future part types.
  parts       jsonb NOT NULL,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_thread_idx
  ON shared.chat_messages (thread_id, created_at);

ALTER TABLE shared.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own chat messages"
  ON shared.chat_messages FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON shared.chat_messages TO authenticated;


-- ----- shared.assistant_memory --------------------------------------------

CREATE TABLE shared.assistant_memory (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  fact       text NOT NULL,
  -- Optional bucket (e.g. "preferences", "training", "context").
  category   text,
  -- Who proposed the memory. Both paths require approval at write time;
  -- this column is just for the audit trail / future filtering.
  source     text NOT NULL DEFAULT 'agent'
               CHECK (source IN ('agent', 'user')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assistant_memory_user_recent_idx
  ON shared.assistant_memory (user_id, updated_at DESC);

ALTER TABLE shared.assistant_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own assistant memory"
  ON shared.assistant_memory FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER assistant_memory_set_updated_at
  BEFORE UPDATE ON shared.assistant_memory
  FOR EACH ROW EXECUTE FUNCTION shared.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON shared.assistant_memory TO authenticated;
